type Props = {
  count: number;
  last?: {
    eventType: string;
    severity: number;
  };
};

export const ViolationBanner = ({ count, last }: Props) => {
  return (
    <div className="violation-banner" role="status">
      <strong>Violations:</strong> {count}
      {last ? (
        <span>
          Last: {last.eventType} (severity {last.severity})
        </span>
      ) : null}
    </div>
  );
};
