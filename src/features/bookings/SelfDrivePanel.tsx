import { useState } from 'react';
import { FiAlertTriangle, FiCheck, FiRotateCcw, FiX } from 'react-icons/fi';
import { api } from '../../lib/api';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Badge, Panel } from '../../components/ui';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { LicenceThumb, useImageUrl } from '../drivers/LicencePhotos';

/** The self-drive driver's details and licence, as GET /admin/bookings/:id returns them. */
export type SelfDrive = {
  id: string; status: 'pending' | 'approved' | 'rejected'; reviewNote: string | null; reviewedAt: string | null; reviewedBy: string | null; fullName: string;
  restricted: boolean; createdAt?: string;
  dateOfBirth?: string; email?: string; phone?: string; addressLine1?: string; addressLine2?: string | null; city?: string; postcode?: string; country?: string;
  licenceNumber?: string; licenceCountry?: string; licenceIssuedOn?: string; licenceExpiresOn?: string; licenceCheckCode?: string | null; penaltyPoints?: number;
  convictions?: string | null; licenceFront?: { id: string; createdAt: string } | null; licenceBack?: { id: string; createdAt: string } | null;
};

const STATUS_LABEL = { pending: 'Waiting for review', approved: 'Driver approved', rejected: 'Driver turned down' } as const;

/** Whole years between a yyyy-mm-dd date and another date. */
function yearsSince(ymd: string, at: Date) {
  const d = new Date(ymd + 'T00:00:00');
  let y = at.getFullYear() - d.getFullYear();
  if (at.getMonth() < d.getMonth() || (at.getMonth() === d.getMonth() && at.getDate() < d.getDate())) y--;
  return y;
}
const day = (ymd?: string) => (ymd ? fmtDate(ymd + 'T12:00:00', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function Photo({ appId, side }: { appId: string; side: 'front' | 'back' }) {
  const { url, failed } = useImageUrl(`/self-drive/${appId}/licence/${side}`);
  const label = `${side === 'front' ? 'Front' : 'Back'} of licence`;
  return failed ? <div className="muted small">Could not load the {side} photo.</div> : <LicenceThumb src={url} label={label} onOpen={url ? () => window.open(url, '_blank') : undefined} />;
}

const Item = ({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) => (
  <div className={'bd-field' + (wide ? ' wide' : '')}><div className="bd-label">{label}</div><div>{children}</div></div>
);

/**
 * Self-drive: who will drive, their address, contact details and driving licence, with the licence photos. Staff
 * approve the driver or turn them down (with a reason the customer sees); both are logged on the booking.
 */
export function SelfDrivePanel({ sd, startAt, endAt, onChanged }: { sd: SelfDrive; startAt: string; endAt: string; onChanged: () => void }) {
  const [dialog, setDialog] = useState<null | 'approved' | 'rejected' | 'pending'>(null);
  const review = (status: 'approved' | 'rejected' | 'pending', note?: string) => api(`/self-drive/${sd.id}/review`, { body: { status, note: note || null } }).then(onChanged);

  const start = new Date(startAt);
  const warnings: string[] = [];
  if (!sd.restricted) {
    if (sd.licenceExpiresOn && new Date(sd.licenceExpiresOn + 'T23:59:59') < new Date(endAt)) warnings.push('The licence runs out before the booking ends.');
    if (sd.penaltyPoints) warnings.push(`${sd.penaltyPoints} penalty point${sd.penaltyPoints === 1 ? '' : 's'} declared.`);
    if (sd.convictions) warnings.push('Convictions or endorsements declared (see below).');
    if (!sd.licenceBack) warnings.push('No photo of the back of the licence.');
  }

  const actions = (
    <div className="row wrap" style={{ gap: 8 }}>
      {sd.status !== 'approved' ? <button className="btn sm gold" onClick={() => setDialog('approved')}><FiCheck /> Approve driver</button> : null}
      {sd.status !== 'rejected' ? <button className="btn sm danger" onClick={() => setDialog('rejected')}><FiX /> Turn down</button> : null}
      {sd.status !== 'pending' ? <button className="btn sm" onClick={() => setDialog('pending')}><FiRotateCcw /> Back to review</button> : null}
    </div>
  );

  return (
    <Panel title="Self-drive driver" hint="The customer entered these details when booking without a driver. Check them against the licence photos before handing over the car." action={sd.restricted ? undefined : actions}>
      <div className="row wrap" style={{ gap: 10, marginBottom: 14 }}>
        <Badge status={sd.status} label={STATUS_LABEL[sd.status]} />
        {sd.reviewedAt ? <span className="muted small">{sd.status === 'approved' ? 'Approved' : 'Turned down'} by {sd.reviewedBy ?? 'staff'} · {fmtDateTime(sd.reviewedAt)}</span> : sd.createdAt ? <span className="muted small">Sent {fmtDateTime(sd.createdAt)}</span> : null}
      </div>
      {sd.reviewNote ? <div className="note" style={{ marginBottom: 14 }}><b>Note to the customer:</b> {sd.reviewNote}</div> : null}

      {sd.restricted ? (
        <div className="muted small">Driver: {sd.fullName}. Only the owner, administrators and driver coordinators can see licence details.</div>
      ) : (
        <>
          {warnings.length ? (
            <div className="note" style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <FiAlertTriangle style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{warnings.map((w) => <div key={w}>{w}</div>)}</div>
            </div>
          ) : null}
          <div className="bd-fields">
            <Item label="Full name">{sd.fullName}</Item>
            <Item label="Date of birth">{day(sd.dateOfBirth)}{sd.dateOfBirth ? <div className="muted small">{yearsSince(sd.dateOfBirth, start)} years old on the day</div> : null}</Item>
            <Item label="Contact"><a href={`mailto:${sd.email}`}>{sd.email}</a><div><a href={`tel:${sd.phone}`}>{sd.phone}</a></div></Item>
            <Item label="Home address">
              <div>{sd.addressLine1}</div>{sd.addressLine2 ? <div>{sd.addressLine2}</div> : null}
              <div>{sd.city} {sd.postcode}</div><div className="muted small">{sd.country}</div>
            </Item>
            <Item label="Licence number"><span style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: 1 }}>{sd.licenceNumber}</span><div className="muted small">Issued in {sd.licenceCountry}</div></Item>
            <Item label="Licence dates">
              Full licence since {day(sd.licenceIssuedOn)}{sd.licenceIssuedOn ? <span className="muted small"> ({yearsSince(sd.licenceIssuedOn, start)} years)</span> : null}
              <div>Valid until {day(sd.licenceExpiresOn)}</div>
            </Item>
            <Item label="Penalty points">{sd.penaltyPoints ?? 0}</Item>
            <Item label="DVLA check code">{sd.licenceCheckCode
              ? <><span style={{ fontFamily: 'ui-monospace, monospace' }}>{sd.licenceCheckCode}</span><div className="muted small"><a href="https://www.viewdrivingrecord.service.gov.uk/" target="_blank" rel="noreferrer">Check on GOV.UK</a> with the last 8 characters of the licence number</div></>
              : <span className="muted">Not given</span>}</Item>
            {sd.convictions ? <Item label="Declared convictions or endorsements" wide><div className="pre">{sd.convictions}</div></Item> : null}
            <Item label="Licence photos" wide>
              <div className="form-grid" style={{ marginTop: 4 }}>
                {(['front', 'back'] as const).map((side) => {
                  const img = side === 'front' ? sd.licenceFront : sd.licenceBack;
                  return (
                    <div key={side}>
                      <div className="muted small" style={{ marginBottom: 6 }}>{side === 'front' ? 'Front' : 'Back'}{img ? ` · uploaded ${fmtDate(img.createdAt)}` : ''}</div>
                      {img ? <Photo appId={sd.id} side={side} /> : <LicenceThumb src={null} label={side} />}
                    </div>
                  );
                })}
              </div>
              <div className="muted small" style={{ marginTop: 6 }}>Private files: every view is recorded in the audit log. Click a photo to open it full size.</div>
            </Item>
          </div>
        </>
      )}

      {dialog === 'approved' ? (
        <ConfirmDialog title="Approve this driver?" confirmLabel="Approve driver" onClose={() => setDialog(null)} onConfirm={() => review('approved')}
          message={`${sd.fullName} will be told they are approved to drive, and to bring their licence on the day.`} />
      ) : dialog === 'rejected' ? (
        <ConfirmDialog title="Turn this driver down?" confirmLabel="Turn down" danger requireReason reasonLabel="Reason (sent to the customer)" onClose={() => setDialog(null)}
          onConfirm={(reason) => review('rejected', reason)}
          message="The customer is told why. The booking itself stays as it is: change it to a booking with a driver, or cancel and refund it, with the usual buttons." />
      ) : dialog === 'pending' ? (
        <ConfirmDialog title="Put back to review?" confirmLabel="Back to review" onClose={() => setDialog(null)} onConfirm={() => review('pending')}
          message="The decision is cleared and the details wait for a review again. The customer is not notified." />
      ) : null}
    </Panel>
  );
}
