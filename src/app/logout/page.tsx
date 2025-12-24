"use client";

export default function LogoutPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Log out</h1>

      <form action="/logout" method="post">
        <button type="submit">Confirm log out</button>
      </form>
    </div>
  );
}
