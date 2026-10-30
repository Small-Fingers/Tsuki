import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const api = axios.create({ baseURL: API });
api.interceptors.request.use((config) => {
  try {
    const token = JSON.parse(localStorage.getItem('realstate-session'))?.token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    /* The API will return an auth error if there is no saved session. */
  }
  return config;
});
const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value || 0);
const date = (value) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));

function AdminTabs({ active }) {
  return (
    <nav className="admin-tabs" aria-label="Admin sections">
      <Link className={active === 'overview' ? 'active' : ''} to="/admin">
        Overview
      </Link>
      <Link className={active === 'users' ? 'active' : ''} to="/admin/users">
        Users
      </Link>
      <Link className={active === 'properties' ? 'active' : ''} to="/admin/properties">
        Listings
      </Link>
      <Link className={active === 'reports' ? 'active' : ''} to="/admin/reports">
        Reports
      </Link>
      <Link className={active === 'contacts' ? 'active' : ''} to="/admin/contacts">
        Contact inbox
      </Link>
    </nav>
  );
}

function ContactsPanel({ contacts, setContacts, setError }) {
  const updateStatus = async (contact, status) => {
    try {
      const { data } = await api.patch(`/api/admin/contacts/${contact._id}`, { status });
      setContacts((current) =>
        current.map((item) => (item._id === contact._id ? data.contact : item)),
      );
      setError('');
    } catch (error) {
      setError(error.response?.data?.message || 'Could not update contact request.');
    }
  };
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>Contact requests</h2>
          <p>Messages submitted through the public contact form. Reply opens your email app.</p>
        </div>
      </div>
      {contacts.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>From</th>
                <th>Subject</th>
                <th>Message</th>
                <th>Received</th>
                <th>Status</th>
                <th>Reply</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => {
                const subject = encodeURIComponent(`Re: ${contact.subject}`);
                const body = encodeURIComponent(`Hi ${contact.name},\n\n\n\n— Tsuki`);
                return (
                  <tr key={contact._id}>
                    <td>
                      {contact.name}
                      <small>{contact.email}</small>
                    </td>
                    <td>{contact.subject}</td>
                    <td className="contact-message-cell">{contact.message}</td>
                    <td>{date(contact.createdAt)}</td>
                    <td>
                      <select
                        aria-label={`Status for ${contact.subject}`}
                        value={contact.status}
                        onChange={(event) => updateStatus(contact, event.target.value)}
                      >
                        <option value="new">New</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </td>
                    <td>
                      <a
                        className="text-link"
                        href={`mailto:${encodeURIComponent(contact.email)}?subject=${subject}&body=${body}`}
                      >
                        Reply ↗
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-empty">No contact requests yet.</div>
      )}
    </section>
  );
}

const reportReasons = {
  misleading: 'Misleading details',
  unavailable: 'Unavailable property',
  suspicious: 'Suspicious or potentially fraudulent',
  duplicate: 'Duplicate listing',
  other: 'Other concern',
};
function ReportsPanel({ reports, setReports, status, setStatus, setError }) {
  const updateReport = async (report, nextStatus) => {
    const adminNote = window.prompt(
      'Optional internal note for this report:',
      report.adminNote || '',
    );
    if (adminNote === null) return;
    try {
      const { data } = await api.patch(`/api/admin/reports/${report._id}`, {
        status: nextStatus,
        adminNote,
      });
      setReports((current) =>
        current.map((item) => (item._id === report._id ? data.report : item)),
      );
      setError('');
    } catch (error) {
      setError(error.response?.data?.message || 'Could not update listing report.');
    }
  };
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>Listing reports</h2>
          <p>Review buyer reports about inaccurate, unavailable, or suspicious listings.</p>
        </div>
      </div>
      <div className="admin-filters">
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All reports</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="actioned">Action taken</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </label>
      </div>
      {reports.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Reported by</th>
                <th>Reason</th>
                <th>Details</th>
                <th>Received</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report._id}>
                  <td>
                    {report.property ? (
                      <>
                        <Link to={`/properties/${report.property._id}`}>
                          {report.property.title}
                        </Link>
                        <small>
                          {report.property.area}, {report.property.city} ·{' '}
                          {report.property.seller?.name || 'Unknown seller'}
                        </small>
                      </>
                    ) : (
                      'Listing removed'
                    )}
                  </td>
                  <td>
                    {report.reporter?.name || 'Unknown buyer'}
                    <small>{report.reporter?.email || ''}</small>
                  </td>
                  <td>{reportReasons[report.reason] || report.reason}</td>
                  <td className="contact-message-cell">
                    {report.details || '—'}
                    {report.adminNote && <small>Admin note: {report.adminNote}</small>}
                  </td>
                  <td>{date(report.createdAt)}</td>
                  <td>
                    <span
                      className={`admin-badge ${report.status === 'pending' ? '' : 'verified'}`}
                    >
                      {report.status === 'actioned'
                        ? 'Action taken'
                        : report.status[0].toUpperCase() + report.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    {report.status === 'pending' ? (
                      <div className="admin-actions">
                        <button
                          className="button button-quiet"
                          onClick={() => updateReport(report, 'reviewed')}
                        >
                          Mark reviewed
                        </button>
                        <button
                          className="button button-quiet"
                          onClick={() => updateReport(report, 'dismissed')}
                        >
                          Dismiss
                        </button>
                        <button
                          className="button button-danger"
                          onClick={() => updateReport(report, 'actioned')}
                        >
                          Action taken
                        </button>
                      </div>
                    ) : (
                      <button
                        className="button button-quiet"
                        onClick={() => updateReport(report, 'reviewed')}
                      >
                        Update review
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-empty">No listing reports match this status.</div>
      )}
    </section>
  );
}

function Overview({ data }) {
  const stats = [
    [
      'Accounts',
      data.users,
      `${data.roles?.buyer || 0} buyers · ${data.roles?.seller || 0} sellers`,
    ],
    [
      'All listings',
      data.properties,
      `${data.saleListings || 0} for sale · ${data.rentalListings || 0} for rent · ${data.soldListings} sold`,
    ],
    ['Listing views', data.totalViews, 'Across all property pages'],
    ['Admin accounts', data.roles?.admin || 0, 'Accounts with platform access'],
  ];
  return (
    <>
      <div className="admin-stat-grid">
        {stats.map(([label, value, hint]) => (
          <article className="admin-stat" key={label}>
            <span>{label}</span>
            <strong>{Number(value || 0).toLocaleString()}</strong>
            <small>{hint}</small>
          </article>
        ))}
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>Recent listings</h2>
            <p>Latest properties added to Tsuki.</p>
          </div>
          <Link className="text-link" to="/admin/properties">
            Manage listings ↗
          </Link>
        </div>
        {data.recentProperties?.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Seller</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {data.recentProperties.map((property) => (
                  <tr key={property._id}>
                    <td>
                      <Link to={`/properties/${property._id}`}>{property.title}</Link>
                      <small>
                        {property.area}, {property.city}
                      </small>
                    </td>
                    <td>{property.seller?.name || 'Unknown seller'}</td>
                    <td>{money(property.price)}</td>
                    <td>
                      <span className={`admin-badge ${property.isVerified ? 'verified' : ''}`}>
                        {property.isVerified ? 'Verified' : 'Needs review'}
                      </span>
                    </td>
                    <td>{date(property.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty">No listings yet.</div>
        )}
      </section>
    </>
  );
}

function UsersPanel({
  users,
  setUsers,
  search,
  setSearch,
  role,
  setRole,
  currentUserId,
  setError,
}) {
  const changeRole = async (user, nextRole) => {
    try {
      const { data } = await api.patch(`/api/admin/users/${user._id}/role`, { role: nextRole });
      setUsers((current) => current.map((item) => (item._id === user._id ? data.user : item)));
      setError('');
    } catch (error) {
      setError(error.response?.data?.message || 'Could not update account role.');
    }
  };
  const resetPassword = async (user) => {
    const password = window.prompt(
      `Set a temporary password for ${user.name}. Use at least 12 characters.`,
    );
    if (password === null) return;
    if (password.length < 12) {
      setError('Temporary passwords must be at least 12 characters.');
      return;
    }
    if (
      !window.confirm(
        'Set this password now? You must send it to the user privately after verifying their identity.',
      )
    )
      return;
    try {
      const { data } = await api.patch(`/api/admin/users/${user._id}/password`, { password });
      setError('');
      window.alert(data.message);
    } catch (error) {
      setError(error.response?.data?.message || 'Could not reset account password.');
    }
  };
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>Accounts</h2>
          <p>Review account details and assign buyer, seller, or admin roles.</p>
        </div>
      </div>
      <div className="admin-filters">
        <label>
          Search accounts
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or email"
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">All roles</option>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      </div>
      {users.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Role</th>
                <th>Recovery</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{date(user.createdAt)}</td>
                  <td>
                    <select
                      aria-label={`Role for ${user.name}`}
                      value={user.role}
                      disabled={String(user._id) === String(currentUserId)}
                      onChange={(event) => changeRole(user, event.target.value)}
                    >
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <button
                      className="button button-quiet"
                      disabled={String(user._id) === String(currentUserId)}
                      onClick={() => resetPassword(user)}
                    >
                      Set temporary password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-empty">No accounts match these filters.</div>
      )}
    </section>
  );
}

function PropertiesPanel({
  properties,
  setProperties,
  status,
  setStatus,
  verification,
  setVerification,
  setError,
}) {
  const verify = async (property) => {
    try {
      const { data } = await api.patch(`/api/admin/properties/${property._id}/verification`, {
        isVerified: !property.isVerified,
      });
      setProperties((current) =>
        current.map((item) => (item._id === property._id ? data.property : item)),
      );
      setError('');
    } catch (error) {
      setError(error.response?.data?.message || 'Could not update listing verification.');
    }
  };
  const remove = async (property) => {
    if (!window.confirm(`Permanently delete “${property.title}”?`)) return;
    try {
      await api.delete(`/api/admin/properties/${property._id}`);
      setProperties((current) => current.filter((item) => item._id !== property._id));
      setError('');
    } catch (error) {
      setError(error.response?.data?.message || 'Could not delete listing.');
    }
  };
  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>Listings</h2>
          <p>Review, verify, or remove properties.</p>
        </div>
      </div>
      <div className="admin-filters">
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="sale">Available</option>
            <option value="sold">Sold</option>
            <option value="rented">Rented</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </label>
        <label>
          Review
          <select value={verification} onChange={(event) => setVerification(event.target.value)}>
            <option value="">All listings</option>
            <option value="unverified">Needs review</option>
            <option value="verified">Verified</option>
          </select>
        </label>
      </div>
      {properties.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Seller</th>
                <th>Price</th>
                <th>Status</th>
                <th>Review</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((property) => (
                <tr key={property._id}>
                  <td>
                    <Link to={`/properties/${property._id}`}>{property.title}</Link>
                    <small>
                      {property.area}, {property.city}
                    </small>
                  </td>
                  <td>{property.seller?.name || 'Unknown seller'}</td>
                  <td>
                    {money(property.price)}
                    {property.purpose === 'rent' && <small>/ month</small>}
                  </td>
                  <td>
                    {property.status === 'unavailable'
                      ? 'Unavailable'
                      : property.status === 'rented'
                        ? 'Rented'
                        : property.status === 'sold'
                          ? 'Sold'
                          : property.purpose === 'rent'
                            ? 'For rent'
                            : 'For sale'}
                  </td>
                  <td>
                    <span className={`admin-badge ${property.isVerified ? 'verified' : ''}`}>
                      {property.isVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </td>
                  <td className="admin-actions">
                    <button className="button button-quiet" onClick={() => verify(property)}>
                      {property.isVerified ? 'Unverify' : 'Verify'}
                    </button>
                    <button className="button button-danger" onClick={() => remove(property)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-empty">No listings match these filters.</div>
      )}
    </section>
  );
}

export default function AdminDashboard() {
  const location = useLocation();
  const section = location.pathname.endsWith('/users')
    ? 'users'
    : location.pathname.endsWith('/properties')
      ? 'properties'
      : location.pathname.endsWith('/contacts')
        ? 'contacts'
        : location.pathname.endsWith('/reports')
          ? 'reports'
          : 'overview';
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('realstate-session') || 'null')?.user;
    } catch {
      return null;
    }
  })();
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [verification, setVerification] = useState('');
  const [reportStatus, setReportStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    let request;
    if (section === 'overview')
      request = api.get('/api/admin/overview').then(({ data: response }) => {
        if (active) setData(response);
      });
    if (section === 'users')
      request = api
        .get('/api/admin/users', {
          params: { search: search || undefined, role: role || undefined },
        })
        .then(({ data: response }) => {
          if (active) setUsers(response.users);
        });
    if (section === 'properties')
      request = api
        .get('/api/admin/properties', {
          params: { status: status || undefined, verification: verification || undefined },
        })
        .then(({ data: response }) => {
          if (active) setProperties(response.properties);
        });
    if (section === 'contacts')
      request = api.get('/api/admin/contacts').then(({ data: response }) => {
        if (active) setContacts(response.contacts);
      });
    if (section === 'reports')
      request = api
        .get('/api/admin/reports', { params: { status: reportStatus || undefined } })
        .then(({ data: response }) => {
          if (active) setReports(response.reports);
        });
    request
      .catch((requestError) => {
        if (active)
          setError(
            requestError.response?.data?.message ||
              'Could not load admin data. Check the API connection and your admin role.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [section, search, role, status, verification, reportStatus]);

  return (
    <section className="page-wrap admin-page">
      <div className="page-intro">
        <span className="eyebrow">Platform administration</span>
        <h1>
          {section === 'overview'
            ? 'Admin dashboard'
            : section === 'users'
              ? 'User accounts'
              : section === 'contacts'
                ? 'Contact inbox'
                : section === 'reports'
                  ? 'Listing reports'
                  : 'Property listings'}
        </h1>
        <p>Manage Tsuki accounts and review property listings.</p>
      </div>
      <AdminTabs active={section} />
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="loading" role="status">
          Loading admin data…
        </p>
      ) : section === 'overview' && data ? (
        <Overview data={data} />
      ) : section === 'users' ? (
        <UsersPanel
          users={users}
          setUsers={setUsers}
          search={search}
          setSearch={setSearch}
          role={role}
          setRole={setRole}
          currentUserId={currentUser?._id}
          setError={setError}
        />
      ) : section === 'properties' ? (
        <PropertiesPanel
          properties={properties}
          setProperties={setProperties}
          status={status}
          setStatus={setStatus}
          verification={verification}
          setVerification={setVerification}
          setError={setError}
        />
      ) : section === 'contacts' ? (
        <ContactsPanel contacts={contacts} setContacts={setContacts} setError={setError} />
      ) : section === 'reports' ? (
        <ReportsPanel
          reports={reports}
          setReports={setReports}
          status={reportStatus}
          setStatus={setReportStatus}
          setError={setError}
        />
      ) : null}
    </section>
  );
}
