"use client";

export function courierIcon(online: boolean, selected = false): google.maps.Icon {
  const color = online ? "#1b5cf5" : "#94a3b8";
  const ring = selected ? "#f59e0b" : "#ffffff";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    <circle cx="22" cy="22" r="19" fill="${color}" stroke="${ring}" stroke-width="4"/>
    <path d="M13 25h2.2a2.8 2.8 0 0 0 5.6 0h4.4a2.8 2.8 0 0 0 5.6 0H32v-4l-3-4h-4v-3H13v11z" fill="#fff"/>
  </svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(44, 44),
    anchor: new google.maps.Point(22, 22),
  };
}

export function originIcon(): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <rect x="2" y="2" width="36" height="36" rx="8" fill="#059669" stroke="#fff" stroke-width="3"/>
    <path d="M8 28V16l12-7 12 7v12H8z" fill="#fff"/>
    <rect x="17" y="20" width="6" height="8" fill="#059669"/>
  </svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(36, 36),
    anchor: new google.maps.Point(18, 18),
  };
}

export function destinationIcon(): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 12.7 17 27 17 27s17-14.3 17-27C34 7.6 26.4 0 17 0z" fill="#e11d48"/>
    <circle cx="17" cy="17" r="7" fill="#fff"/>
  </svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(30, 40),
    anchor: new google.maps.Point(15, 40),
  };
}
