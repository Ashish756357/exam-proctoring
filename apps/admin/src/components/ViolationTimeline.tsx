type Event = {
  _id: string;
  eventType: string;
  severity: number;
  source: string;
  timestamp: string;
};

type Props = {
  events: Event[];
};

export const ViolationTimeline = ({ events }: Props) => {
  return (
    <section className="panel">
      <h2>Violation Timeline</h2>
      <div className="timeline">
        {events.map((event) => (
          <article key={event._id} className="timeline-item">
            <strong>{event.eventType}</strong>
            <span>Source: {event.source}</span>
            <span>Severity: {event.severity}</span>
            <time>{new Date(event.timestamp).toLocaleTimeString()}</time>
          </article>
        ))}
      </div>
    </section>
  );
};
