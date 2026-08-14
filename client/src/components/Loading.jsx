export default function Loading({ label = "Loading Nexora" }) {
  return <div className="loading" role="status"><span className="spinner" /><span>{label}</span></div>;
}
