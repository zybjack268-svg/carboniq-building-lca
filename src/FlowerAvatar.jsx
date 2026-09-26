import React, { useEffect, useRef } from "react";
import { BotAvatar } from "bot-avatars";
import "./flower-avatar.css";

/** The same agent identity is used for every response and the A1 upload screen. */
export default function FlowerAvatar({ working = false, size = 34, followPointer = false }) {
  const hostRef = useRef(null);

  useEffect(() => {
    if (!followPointer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const host = hostRef.current;
    if (!host) return undefined;
    let frame = 0;
    const move = (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = event.clientX / window.innerWidth * 2 - 1;
        const y = event.clientY / window.innerHeight * 2 - 1;
        host.style.transform = `perspective(280px) rotateY(${(x * 18).toFixed(1)}deg) rotateX(${(-y * 11).toFixed(1)}deg)`;
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(frame); host.style.transform = ""; };
  }, [followPointer]);

  return <span ref={hostRef} className={`flower-avatar ${followPointer ? "flower-avatar-follow" : ""}`}><BotAvatar type="flower" face="mouth" color="#5bbf77" theme="light" size={size} state={working ? "working" : "default"} interactive turn={followPointer ? 1.6 : 1} depth={followPointer ? 1.15 : .65}/></span>;
}
