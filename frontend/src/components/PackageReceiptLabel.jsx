import React, { useState } from 'react';
import { packageReceiptPath } from '../../../shared/packageReceiptPath.js';
import { downloadDocument } from '../utils/downloadDocument.js';

export default function PackageReceiptLabel({ packageId, packageNumber }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!packageReceiptPath(packageId)) return null;

  async function download() {
    setBusy(true);
    setError('');
    try {
      await downloadDocument(`/documents/packages/${packageId}/receipt-label`, `${packageNumber || packageId}-RECEIPT-LABEL`);
    } catch (failure) {
      setError(failure.message || 'Could not download the package label.');
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <button type="button" onClick={download} disabled={busy} className="font-semibold text-sky-800 underline disabled:opacity-50">
      {busy ? 'Preparing receipt QR label…' : 'Download receipt QR label'}
    </button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
