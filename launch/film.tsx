import React, {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import {
  ArrowRight,
  Check,
  FileText,
  Folder,
  GitBranch,
  Layers3,
  MessageSquare,
  MousePointer2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import "../src/fonts.css";
import "../src/tokens.css";
import "./film.css";

// One deterministic clock controls every reveal. Export never records wall time.
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
function appear(time: number, start: number, duration = 0.7): CSSProperties {
  const x = ease((time - start) / duration);
  return { opacity: x, transform: `translateY(${(1 - x) * 14}px)` };
}
function Scene({
  time,
  start,
  end,
  children,
  className = "",
}: {
  time: number;
  start: number;
  end: number;
  children: ReactNode;
  className?: string;
}) {
  if (time < start || time >= end) return null;
  return (
    <section
      className={`scene ${className}`}
      style={{
        opacity: Math.min(
          ease((time - start) / 0.65),
          ease((end - time) / 0.45),
        ),
      }}
    >
      {children}
    </section>
  );
}
const Brand = ({ name }: { name: string }) => (
  <div className="brand">
    <span className="brand-mark">
      <Layers3 size={21} />
    </span>
    <span>{name}</span>
  </div>
);

function Film({ time, name }: { time: number; name: string }) {
  const approved = time >= 16;
  const prompt = "Read the call notes. Prepare the next step for Northstar.";
  const typed = prompt.slice(0, Math.floor(Math.max(0, time - 5.5) * 28));
  return (
    <div
      className={`film ${time < 4 || time >= 35 ? "film-cover" : ""}`}
      aria-label="Illustrative Open CRM launch film"
    >
      <header className="film-masthead">
        <Brand name={name} />
        <span className="masthead-credit">With Zentrik</span>
      </header>
      <Scene time={time} start={0} end={4} className="opening">
        <p className="eyebrow" style={appear(time, 0.3)}>
          For the people behind the pipeline
        </p>
        <h1 style={appear(time, 0.6)}>
          Keep the relationship.
          <br />
          <em>Lose the upkeep.</em>
        </h1>
        <p className="deck" style={appear(time, 1.2)}>
          A workspace for you and your agent.
        </p>
        <div
          className="opening-rule"
          style={{ transform: `scaleX(${ease((time - 0.7) / 1.4)})` }}
        />
      </Scene>

      <Scene time={time} start={4} end={22} className="work-scene">
        <div className="chapter">
          <span className="eyebrow">01 / From context to action</span>
          <h1>
            {time < 12
              ? "Ask your agent."
              : time < 16
                ? "Review what it proposes."
                : "Leave with a next step."}
          </h1>
        </div>
        <div className="work-grid">
          <div className="conversation" style={appear(time, 4.4)}>
            <div className="panel-heading">
              <span className="agent-dot" />
              <span>External coding agent</span>
              <span className="meta">CLI / MCP</span>
            </div>
            <div className="conversation-body">
              <div className="speaker">You</div>
              <p className="prompt">
                {typed}
                <span className="caret" style={{ opacity: time < 8 ? 1 : 0 }}>
                  │
                </span>
              </p>
              <div style={appear(time, 8.3)}>
                <div className="speaker agent-label">Agent</div>
                <p className="response">
                  Maya owns the legal review.
                  <br />
                  I’ve prepared the follow-up task.
                </p>
                <div className="source-inline">
                  <FileText size={17} />
                  Northstar call note
                </div>
              </div>
              <div className="agent-result" style={appear(time, 16.2)}>
                <Check size={19} />
                <span>Task added. Source attached.</span>
              </div>
            </div>
            <div className="composer">
              <span>Ask about your accounts…</span>
              <ArrowRight size={18} />
            </div>
          </div>
          <div className="account-surface" style={appear(time, 4.8)}>
            <div className="panel-heading">
              <Layers3 size={17} />
              <span>{name}</span>
              <span className="meta">Northstar Robotics</span>
            </div>
            <div className="account-body">
              <div className="account-heading">
                <div>
                  <p className="eyebrow">Account memory</p>
                  <h2>Northstar Robotics</h2>
                </div>
                <span className="stage-label">Active</span>
              </div>
              <div
                className="source-note"
                style={{
                  ...appear(time, 6.5),
                  display: time >= 12 ? "none" : undefined,
                }}
              >
                <div className="source-title">
                  <FileText size={18} />
                  Call note
                </div>
                <blockquote>
                  “Maya owns the legal review.
                  <br />
                  Let’s confirm it on Thursday.”
                </blockquote>
                <p className="meta">Source attached to the proposed task</p>
              </div>
              <div
                className={`proposal ${approved ? "is-saved" : ""}`}
                style={{
                  ...appear(time, 12),
                  display: time < 12 ? "none" : undefined,
                }}
              >
                <div className="proposal-heading">
                  <span
                    className={approved ? "status-success" : "status-agent"}
                  >
                    {approved ? <Check size={17} /> : <Sparkles size={17} />}{" "}
                    {approved ? "Added to your workspace" : "Proposed task"}
                  </span>
                  <span className="meta">Maya · Thursday</span>
                </div>
                <h3>Confirm the legal review</h3>
                <p>
                  “Maya owns the legal review. Let’s confirm it on Thursday.”
                </p>
                <div className="source-inline">
                  <FileText size={16} />
                  Northstar call note
                </div>
                <div className="proposal-actions">
                  <span className={`approve ${approved ? "approved" : ""}`}>
                    {approved ? <Check size={17} /> : null}
                    {approved ? "Approved" : "Approve task"}
                  </span>
                  {!approved && <span className="reject">Reject</span>}
                </div>
              </div>
              <div className="account-summary">
                <div>
                  <span className="summary-label">Next actions</span>
                  <strong
                    key={String(approved)}
                    style={approved ? appear(time, 16) : {}}
                  >
                    {approved ? "3" : "2"}
                  </strong>
                </div>
                <div>
                  <span className="summary-label">Owner</span>
                  <strong>Maya</strong>
                </div>
                <div>
                  <span className="summary-label">Evidence</span>
                  <strong>Call note</strong>
                </div>
              </div>
            </div>
            {time >= 14.9 && time < 16.5 && (
              <MousePointer2
                className="film-cursor"
                size={27}
                fill="currentColor"
                style={{
                  transform: `translate(${(1 - ease((time - 14.9) / 0.8)) * 95}px,${(1 - ease((time - 14.9) / 0.8)) * 50}px) scale(${time >= 15.85 && time < 16.05 ? 0.88 : 1})`,
                }}
              />
            )}
          </div>
        </div>
      </Scene>

      <Scene time={time} start={22} end={29} className="ownership">
        <span className="eyebrow">02 / On your terms</span>
        <h1>
          Open. Local. <em>Yours.</em>
        </h1>
        <div className="ownership-grid">
          <article style={appear(time, 22.7)}>
            <GitBranch />
            <h2>Read the code.</h2>
            <p>
              Open source.
              <br />
              Ready to make your own.
            </p>
            <code>Apache 2.0</code>
          </article>
          <article style={appear(time, 23.4)}>
            <Folder />
            <h2>Keep your records.</h2>
            <p>
              A workspace folder.
              <br />
              On your computer.
            </p>
            <code>accounts / notes / tasks</code>
          </article>
          <article style={appear(time, 24.1)}>
            <ShieldCheck />
            <h2>Choose your agent.</h2>
            <p>
              Work through the CLI or MCP.
              <br />
              Review changes together.
            </p>
            <code>Codex · Claude Code · Cursor</code>
          </article>
        </div>
      </Scene>

      <Scene time={time} start={29} end={35} className="evolution">
        <span className="eyebrow">03 / Built with Zentrik</span>
        <h1>Help shape the next version.</h1>
        <div className="feedback-example" style={appear(time, 29.6)}>
          <MessageSquare size={24} />
          <p>“Make waiting accounts easier to review.”</p>
        </div>
        <div className="evolution-track">
          <div style={appear(time, 30.2)}>
            <span className="step-number">01</span>
            <h2>Capture feedback</h2>
            <p>Keep the context.</p>
          </div>
          <ArrowRight className="flow-arrow" style={appear(time, 30.8)} />
          <div style={appear(time, 31)}>
            <span className="step-number">02</span>
            <h2>Prepare the handoff</h2>
            <p>Local draft. Reviewed before sharing.</p>
          </div>
          <ArrowRight className="flow-arrow" style={appear(time, 31.6)} />
          <div style={appear(time, 31.8)}>
            <span className="step-number">03</span>
            <h2>Guide product work</h2>
            <p>With Zentrik and agents.</p>
          </div>
        </div>
      </Scene>

      <Scene time={time} start={35} end={41} className="closing">
        <p className="eyebrow">An open-source agentic relationship manager</p>
        <h1>{name}</h1>
        <p className="deck">Your context. Your agent. Your next move.</p>
        <div className="closing-link" style={appear(time, 35.8)}>
          <span>Explore the project</span>
          <ArrowRight />
          <span className="repo">github.com/Zentrik-AI/zentrik-open-crm</span>
        </div>
      </Scene>
      <footer className="film-footer">
        <span>
          {time >= 4 && time < 22
            ? "Illustrative workflow · synthetic records"
            : time >= 22 && time < 29
              ? "Agent requests use the provider you choose."
              : time >= 29 && time < 35
                ? "Local feedback handoff. Connected delivery requires configuration."
                : "Open source. Local first."}
        </span>
        <span>
          {time < 4
            ? "INTRODUCING"
            : time >= 35
              ? "OPEN CRM"
              : "OPEN CRM / PRODUCT FILM"}
        </span>
      </footer>
      <div
        className="film-progress"
        style={{ transform: `scaleX(${time / 41})` }}
      />
    </div>
  );
}

declare global {
  interface Window {
    setFilmTime: (time: number) => void;
  }
}
function Player() {
  const params = new URLSearchParams(location.search),
    capture = params.has("capture");
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false);
  const [name, setName] = useState(params.get("name") || "Open CRM");
  const [scale, setScale] = useState(
    capture
      ? 1
      : Math.min((innerWidth - 48) / 1280, (innerHeight - 140) / 720, 1),
  );
  window.setFilmTime = (t) => flushSync(() => setTime(t));
  useEffect(() => {
    if (capture) return;
    const resize = () =>
      setScale(
        Math.max(
          0.2,
          Math.min((innerWidth - 48) / 1280, (innerHeight - 140) / 720, 1),
        ),
      );
    addEventListener("resize", resize);
    return () => removeEventListener("resize", resize);
  }, [capture]);
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    const start = performance.now() - time * 1000;
    const tick = (now: number) => {
      const next = Math.min(41, (now - start) / 1000);
      setTime(next);
      if (next < 41) id = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);
  return (
    <main className={capture ? "capture" : "preview"}>
      <div
        className="film-wrap"
        style={{ width: 1280 * scale, height: 720 * scale }}
      >
        <div
          style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          <Film time={time} name={name} />
        </div>
      </div>
      {!capture && (
        <div className="player-controls">
          <button
            onClick={() => {
              if (time >= 41) setTime(0);
              setPlaying((v) => !v);
            }}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <input
            aria-label="Film time"
            type="range"
            min="0"
            max="40.95"
            step=".05"
            value={time}
            onChange={(e) => {
              setPlaying(false);
              setTime(Number(e.target.value));
            }}
          />
          <output>{time.toFixed(1)} / 41s</output>
          <label>
            Name{" "}
            <select value={name} onChange={(e) => setName(e.target.value)}>
              <option>Open CRM</option>
              <option>Ozarm</option>
            </select>
          </label>
          <a href="/tmp/launch/launch-film.mp4">Watch with music</a>
        </div>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Player />);
