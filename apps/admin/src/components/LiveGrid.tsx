type Session = {
  id: string;
  exam: { id: string; title: string };
  candidate: { id: string; name: string; email: string };
  violationScore: number;
  startedAt: string;
  mobilePairedAt?: string;
};

type Props = {
  sessions: Session[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
};

export const LiveGrid = ({ sessions, selectedSessionId, onSelect }: Props) => {
  return (
    <section className="panel">
      <h2>Live Candidates</h2>
      <div className="grid">
        {sessions.map((session) => (
          <button
            key={session.id}
            className={`session-card ${selectedSessionId === session.id ? "selected" : ""}`}
            onClick={() => onSelect(session.id)}
          >
            <h3>{session.candidate.name}</h3>
            <p>{session.exam.title}</p>
            <p>Risk: {session.violationScore}</p>
            <p>Mobile: {session.mobilePairedAt ? "Connected" : "Waiting"}</p>
            <div className="feed-row">
              <div className="feed-placeholder">Laptop Cam</div>
              <div className="feed-placeholder">Mobile Cam</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
