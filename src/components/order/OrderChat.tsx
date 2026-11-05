"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Send, Square } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/ToastProvider";
import type { OrderMessage } from "@/lib/types";
import { errMsg } from "@/lib/utils";

const MESSAGE_SELECT = "id,order_id,sender_id,kind,body,audio_base64,audio_mime,created_at";

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read the recording"));
    reader.readAsDataURL(blob);
  });
}

function makeRecorder(stream: MediaStream) {
  const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
  const withRate: MediaRecorderOptions = { audioBitsPerSecond: 24000 };
  if (preferred) withRate.mimeType = preferred;
  try {
    return new MediaRecorder(stream, withRate);
  } catch {
    return preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
  }
}

export function OrderChat({ orderId, meId, title }: { orderId: string; meId: string; title: string }) {
  const supabase = supabaseBrowser();
  const toast = useToast();
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [draft, setDraft] = useState<{ b64: string; mime: string; url: string } | null>(null);
  const [setup, setSetup] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const draftUrl = useRef<string | null>(null);

  const load = useCallback(async () => {
    const [{ data, error }, hides] = await Promise.all([
      supabase.from("order_messages").select(MESSAGE_SELECT).eq("order_id", orderId).order("created_at").limit(100),
      supabase.from("order_message_hides").select("message_id").eq("user_id", meId),
    ]);
    if (error) {
      setSetup(/order_messages|schema cache/i.test(error.message));
      return;
    }
    const hidden = new Set((hides.data || []).map((row) => row.message_id as string));
    setSetup(false);
    setMessages(((data as OrderMessage[]) || []).filter((message) => !hidden.has(message.id)));
  }, [meId, orderId, supabase]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`order-chat-${orderId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` }, (payload) => {
        const row = payload.new as OrderMessage;
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (id) setMessages((prev) => prev.filter((message) => message.id !== id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load, orderId, supabase]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, draft]);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (draftUrl.current) URL.revokeObjectURL(draftUrl.current);
    };
  }, []);

  function clearDraft() {
    if (draftUrl.current) URL.revokeObjectURL(draftUrl.current);
    draftUrl.current = null;
    setDraft(null);
  }

  async function send(kind: "text" | "voice", body?: string, audio?: { b64: string; mime: string }) {
    setSending(true);
    const { error } = await supabase.rpc("send_order_message", {
      p_order_id: orderId,
      p_kind: kind,
      p_body: body ?? null,
      p_audio_base64: audio?.b64 ?? null,
      p_audio_mime: audio?.mime ?? null,
    });
    setSending(false);
    if (error) {
      const missing = /order_messages|send_order_message|schema cache/i.test(error.message);
      if (missing) setSetup(true);
      return toast.error(missing ? "Run supabase/order_chat.sql once in the Supabase SQL editor, then try again." : errMsg(error));
    }
    if (kind === "text") setText("");
    else clearDraft();
    await load();
  }

  async function removeMessage(id: string) {
    const message = messages.find((item) => item.id === id);
    const mine = message?.sender_id?.toLowerCase() === meId?.toLowerCase();
    if (!confirm(mine ? "Delete this message for both of you?" : "Remove this message from your chat only?")) return;
    if (mine) {
      const { data, error } = await supabase.from("order_messages").delete().eq("id", id).select("id");
      if (error || !data?.length) {
        return toast.error("Run supabase/message_delete.sql once in the Supabase SQL editor, then try again.");
      }
    } else {
      const { error } = await supabase.from("order_message_hides").insert({ message_id: id, user_id: meId });
      if (error) {
        return toast.error("Run supabase/message_delete.sql once in the Supabase SQL editor, then try again.");
      }
    }
    setMessages((prev) => prev.filter((item) => item.id !== id));
  }

  async function sendText(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    await send("text", body);
  }

  async function toggleRecord() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) return toast.error("This browser cannot record voice messages");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return toast.error("Allow the microphone to send a voice message");
    }
    clearDraft();
    const rec = makeRecorder(stream);
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
      setRecording(false);
      const mime = (rec.mimeType || "audio/webm").split(";")[0];
      const blob = new Blob(chunks, { type: mime });
      if (blob.size < 800) return;
      if (blob.size > 250000) return toast.error("Voice message is too long. Keep it under 30 seconds.");
      try {
        const b64 = await blobToBase64(blob);
        const url = URL.createObjectURL(blob);
        draftUrl.current = url;
        setDraft({ b64, mime, url });
      } catch (err) {
        toast.error(errMsg(err));
      }
    };
    recRef.current = rec;
    rec.start();
    setRecording(true);
    setSeconds(0);
    const started = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setSeconds(elapsed);
      if (elapsed >= 30) rec.stop();
    }, 250);
  }

  return (
    <section className="card p-5">
      <h2 className="font-bold">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">Text or a voice note, up to 30 seconds. The other person gets a notification.</p>
      {setup && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Run supabase/order_chat.sql once in the Supabase SQL editor, then reload this page.</p>}
      <div ref={listRef} className="mt-3 flex max-h-80 min-h-36 flex-col gap-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
        {messages.length === 0 && <p className="m-auto text-center text-sm text-slate-400">No messages yet.</p>}
        {messages.map((message) => {
          const mine = message.sender_id?.toLowerCase() === meId?.toLowerCase();
          const when = new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "ml-auto bg-brand-600 text-white" : "bg-white text-slate-800"}`}>
              {message.kind === "voice" && message.audio_base64 ? (
                <audio controls preload="none" src={`data:${message.audio_mime || "audio/webm"};base64,${message.audio_base64}`} className="h-9 max-w-full" />
              ) : (
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
              )}
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className={`text-[10px] ${mine ? "text-brand-100" : "text-slate-400"}`}>{when}</p>
                <button type="button" onClick={() => removeMessage(message.id)} className={`text-[11px] font-semibold underline ${mine ? "text-white" : "text-rose-600"}`}>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {draft && (
        <div className="mt-3 flex items-center gap-2">
          <audio controls src={draft.url} className="h-9 min-w-0 flex-1" />
          <button type="button" disabled={sending} onClick={() => send("voice", undefined, draft)} className="btn-primary btn-sm">
            {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Send
          </button>
          <button type="button" onClick={clearDraft} className="btn-secondary btn-sm">Cancel</button>
        </div>
      )}
      <form onSubmit={sendText} className="mt-3 flex items-center gap-2">
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message"
          maxLength={500}
          disabled={setup || recording}
        />
        <button type="button" onClick={toggleRecord} disabled={setup || sending} className={recording ? "btn-danger btn-sm" : "btn-secondary btn-sm"} aria-label={recording ? "Stop recording" : "Record a voice message"}>
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {recording ? `${seconds}s` : ""}
        </button>
        <button type="submit" disabled={setup || sending || recording || !text.trim()} className="btn-primary btn-sm" aria-label="Send message">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </section>
  );
}
