# Mess — Investor Demo Script

> **Setup before demo:** Have 3 browser tabs open (or 3 incognito windows) — one per role: Shipper, Driver, Admin.

---

## Act 1 — The Problem & Registration *(2 min)*

> *"Freight in West Africa is a phone-call business. No visibility, no guarantees. Mess fixes that."*

### Step 1 — Register as a Shipper
1. Go to `/auth/register`
2. Enter full name, phone number
3. Select role: **Shipper**
4. Submit → lands on OTP verification screen
5. Enter OTP → verified

### Step 2 — Register as a Driver *(separate tab)*
1. Same flow, select role: **Driver**

💬 *"Phone-number based auth. No email needed — matches how our users actually operate."*

---

## Act 2 — Creating & Publishing a Freight Order *(3 min)*

*Switch to **Shipper** tab*

### Step 3 — Create an Order
1. Navigate to **Orders → New Order** (`/orders/new`)
2. Fill in:
   - **Cargo type:** General
   - **Weight:** 5000 kg
   - **Pickup:** Dakar, with a date/time
   - **Delivery:** Thiès
   - **Budget:** 150,000 XOF
3. Click **"Create & Publish"** *(not Save as Draft)*

### Step 4 — See it in the Orders List
1. Navigate to `/orders`
2. Show the new order with status badge **Posted** → **Bidding**
3. Click into the order detail — show the route, cargo info, and bid section

💬 *"The moment it's published, it's live. Drivers see it instantly."*

---

## Act 3 — Driver Bids *(3 min)*

*Switch to **Driver** tab*

### Step 5 — Driver Views Available Orders
1. Navigate to **My Missions** (`/orders`)
2. Show the shipper's order appearing in the list
3. Click into it to view the full details

### Step 6 — Submit a Bid
1. On the order detail page, submit a bid:
   - **Price:** 140,000 XOF *(undercutting the budget)*
   - **Estimated pickup time**
2. Confirm bid submitted

*Switch back to **Shipper** tab*

### Step 7 — Shipper Accepts the Bid
1. Refresh the order detail page
2. Show the incoming bid from the driver
3. Click **Accept Bid**
4. Status changes: **Bidding → Assigned**

💬 *"Competitive bidding drives fair pricing. Shippers get the best rate, drivers compete on value."*

---

## Act 4 — Real-Time GPS Tracking *(4 min)*

> ⭐ This is the visual wow moment.

*Switch to **Driver** tab*

### Step 8 — Driver Goes Online
1. In the topbar, toggle availability to **Available** *(green dot)*
2. Navigate to **My Missions** → open the assigned order
3. Update status to **Picked Up** → then **In Transit**

### Step 9 — Driver Streams Location
1. Navigate to **GPS Tracking** (`/tracking`)
2. Allow browser location permissions
3. Show the **"Connected"** indicator in the topbar

*Switch to **Shipper** tab (or open tracking on a second screen)*

### Step 10 — Shipper Watches Live
1. Navigate to **GPS Tracking** (`/tracking?order=<id>`)
2. Show the driver marker moving on the Leaflet map
3. Show speed (km/h) and last-update timestamp updating in real-time

💬 *"Full real-time visibility over WebSockets. The shipper knows exactly where their cargo is — no phone calls needed."*

---

## Act 5 — Messaging *(1 min)*

### Step 11 — In-Order Communication
1. **Shipper tab** → navigate to **Messages** (`/messaging`)
2. Open the conversation for this order
3. Send a message: *"Please call when you arrive at the gate"*
4. **Switch to Driver tab** → show the message received in real-time
5. Driver replies

💬 *"All communication is tied to the order — full audit trail, no lost context."*

---

## Act 6 — Delivery & Completion *(2 min)*

*On **Driver** tab*

### Step 12 — Mark as Delivered
1. Open the order
2. Update status → **Delivered**

*Switch to **Shipper** tab*

### Step 13 — Confirm Delivery
1. Open the order notification or order detail
2. Click **Confirm Delivery**
3. Status → **Completed**
4. Rate the driver *(1–5 stars)*

💬 *"Both parties confirm. The rating system builds trust and a reputation layer on top of every transaction."*

---

## Act 7 — Admin Dashboard *(1 min)*

*Switch to **Admin** tab (or log in as admin)*

### Step 14 — Platform Overview
1. Go to **Dashboard** — show aggregate stats: total orders, in-transit, completed
2. Go to **Admin** panel — show all users and orders across the platform
3. Show the **Notifications** center

💬 *"Full operator visibility. We see everything — for compliance, dispute resolution, and platform health."*

---

## Summary Talking Points for Q&A

| Feature | What it shows |
| --- | --- |
| Phone-based OTP auth | Built for users without email |
| Bidding system | Market-driven pricing, not fixed rates |
| Real-time GPS | Core differentiator vs. phone/WhatsApp-based logistics |
| In-order messaging | Traceability and accountability |
| Multi-role platform | Network effects — every new driver makes it better for shippers |
| XOF currency, French/Wolof i18n | Built specifically for West African market |

---

> **Total demo time: ~15 minutes.** Keep Acts 1–3 brisk, spend the most time on Act 4 (GPS tracking) — it's the most visually compelling moment.
