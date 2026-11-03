"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  minLength,
  required,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        required={required}
        minLength={minLength}
        className="input pr-11"
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow((visible) => !visible)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
