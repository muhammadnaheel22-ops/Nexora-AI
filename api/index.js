import app from "../server/src/app.js";

export default function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const path = url.searchParams.get("path");

  if (path) {
    url.searchParams.delete("path");
    const query = url.searchParams.toString();
    req.url = `/api/${path}${query ? `?${query}` : ""}`;
  }

  return app(req, res);
}
