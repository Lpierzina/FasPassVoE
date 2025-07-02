import React, { useState, useRef } from 'react';
import axios from 'axios';
import './index.css';

function App() {
  const [borrowerName, setBorrowerName] = useState('');
  const [appId, setAppId] = useState('');
  const [employmentData, setEmploymentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('start'); // start | bridge | pay | done
  const paypalRef = useRef();

  // 1. Payroll Connect (Truv Bridge V2)
  const handlePayrollConnect = async () => {
    setError(null);
    setLoading(true);
    if (!borrowerName.trim()) {
      setError("Please enter the borrower's name.");
      setLoading(false);
      return;
    }
    try {
      const user_id = `borrower-${borrowerName.trim().replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
      const userRes = await axios.post('/api/truv-create-user', {
        user_id,
        first_name: borrowerName.trim(),
      });
      const userId = userRes.data.id;
      const bridgeTokenRes = await axios.post('/api/truv-bridge-token', { user_id: userId });
      const bridgeToken = bridgeTokenRes.data.bridge_token;

      // Load Truv Bridge widget
      if (!window.TruvBridge) {
        setError('Truv Bridge script not loaded');
        setLoading(false);
        return;
      }
      setStep('bridge');
      setLoading(false);

      const bridge = window.TruvBridge.init({
        bridgeToken: bridgeToken,
        onSuccess: async function (public_token) {
          setLoading(true);
          try {
            // Exchange for access_token and link_id
            const exchange = await axios.post('/api/truv-exchange-public-token', { public_token });
            const { link_id } = exchange.data;
            // Fetch employment data
            const result = await axios.get(`/api/truv-employment/${link_id}`);
            if (result.data && (result.data.employments || result.data.id)) {
              setEmploymentData({
                borrower_name: borrowerName.trim(),
                app_id: appId.trim(),
                timestamp: new Date().toISOString(),
                verified_data: result.data,
                link_id,
              });
              setStep('pay');
            } else {
              setError('No valid employment or income data found. Not charging.');
            }
          } catch (err) {
            setError('Error retrieving employment data.');
          } finally {
            setLoading(false);
          }
        },
        onError: (err) => {
          setError('Failed to connect with payroll provider.');
          setLoading(false);
        },
        onClose: () => {},
      });
      bridge.open();
    } catch (err) {
      setError('Failed to create user or bridge token.');
      setLoading(false);
    }
  };

  // 2. PayPal Button Logic (renders after employmentData is present)
  React.useEffect(() => {
    if (step === 'pay' && window.paypal && paypalRef.current) {
      window.paypal.Buttons({
        style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'paypal' },
        createOrder: (data, actions) => actions.order.create({
          purchase_units: [{ amount: { value: '0.01' } }], // $0.01 for sandbox
        }),
        onApprove: async (data, actions) => {
          setLoading(true);
          setError(null);
          try {
            const details = await actions.order.capture();
            // Send employment data + PayPal payment info to backend for processing
            // In this demo, we just display success.
            setStep('done');
            setEmploymentData((prev) => ({
              ...prev,
              paypalDetails: details,
            }));
          } catch (err) {
            setError('Failed to process payment or deliver report.');
          } finally {
            setLoading(false);
          }
        },
        onError: (err) => {
          setError('PayPal transaction failed.');
        },
      }).render(paypalRef.current);
    }
  }, [step, employmentData]);

  return (
    <div className="container">
      <h1>FastPass Employment & Income Verification</h1>
      <p>
        Secure, instant proof of employment for lending. Connect, preview, pay, and send to lender—all in one step.
      </p>

      {(step === 'start') && (
        <>
          <input
            type="text"
            placeholder="Borrower Full Name"
            value={borrowerName}
            onChange={(e) => setBorrowerName(e.target.value)}
            className="text-input"
          />
          <input
            type="text"
            placeholder="Loan Application ID (optional)"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            className="text-input"
          />
          <button className="primary-button" onClick={handlePayrollConnect} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect Payroll'}
          </button>
        </>
      )}

      {error && <div className="error-message">{error}</div>}

      {step === 'bridge' && (
        <div className="results-box">
          <h3>Truv Bridge Opened</h3>
          <p>Follow instructions in the popup. <b>Use Truv sandbox credentials:</b></p>
          <ul>
            <li>Username: <b>goodlogin</b></li>
            <li>Password: <b>goodpassword</b></li>
            <li>SSN: <b>991-91-9991</b></li>
          </ul>
          <p>When done, you'll see a data preview and payment button.</p>
        </div>
      )}

      {step === 'pay' && employmentData && (
        <div className="results-box">
          <h3>✅ Data Verified</h3>
          <p>Review your verified employment/income info. Pay to deliver to lender.</p>
          <pre style={{ maxHeight: 200, overflow: 'auto' }}>
            {JSON.stringify(employmentData.verified_data, null, 2)}
          </pre>
          <div ref={paypalRef} style={{ marginTop: 16 }} />
        </div>
      )}

      {step === 'done' && employmentData && (
        <div className="results-box">
          <h3>✅ Payment Complete</h3>
          <p>Your verified report has been delivered to your lender!</p>
          <pre style={{ maxHeight: 200, overflow: 'auto' }}>
            {JSON.stringify(employmentData.paypalDetails, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;
