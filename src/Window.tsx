import { useState, useRef, type ReactNode } from 'react';

interface WindowProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  style?: React.CSSProperties;
  onFocus?: () => void;
}

export function Window({ title, onClose, children, style, onFocus }: WindowProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const startPos = useRef({ pointerX: 0, pointerY: 0, posX: 0, posY: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    // Ignore click if clicking close button
    if ((e.target as HTMLElement).closest('button')) return;
    onFocus?.();
    isDragging.current = true;
    startPos.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: position.x,
      posY: position.y
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - startPos.current.pointerX;
    const dy = e.clientY - startPos.current.pointerY;
    setPosition({
      x: Math.max(-window.innerWidth * 0.45, Math.min(window.innerWidth * 0.45, startPos.current.posX + dx)),
      y: Math.max(-180, Math.min(window.innerHeight * 0.45, startPos.current.posY + dy))
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <section
      className="window"
      onMouseDown={onFocus}
      style={{ ...style, transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <header
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span>{title}</span>
        <button aria-label="Fechar janela" onClick={onClose}>X</button>
      </header>
      <div className="window-content">{children}</div>
    </section>
  );
}
