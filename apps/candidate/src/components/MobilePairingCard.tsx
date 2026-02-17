import { QRCodeSVG } from "qrcode.react";

type Props = {
  pairingUrl: string;
  expiresInSeconds: number;
};

export const MobilePairingCard = ({ pairingUrl, expiresInSeconds }: Props) => {
  return (
    <section className="card pairing-card">
      <h3>Pair Mobile Camera</h3>
      <p>Scan this QR code with your phone to connect the third-person camera.</p>
      <div className="qr-wrap">
        <QRCodeSVG value={pairingUrl} size={180} includeMargin />
      </div>
      <p className="tiny">Token expires in {expiresInSeconds}s</p>
      <code>{pairingUrl}</code>
    </section>
  );
};
