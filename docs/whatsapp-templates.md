# WhatsApp message templates

WhatsApp only allows free-form messages within 24 hours of the customer messaging you first. AwaMenu always messages first: order updates and sign-in codes. So **every WhatsApp message must use a template approved by Meta**. Otherwise Twilio rejects it (error 63016) and the customer gets nothing.

SMS and email are not affected.

## How to set them up

1. In the Twilio Console, go to **Messaging → Content Template Builder → Create new**.
2. Create each template below **exactly as written**, in language **English**, with the category shown.
3. Submit each one for **WhatsApp approval**. Meta usually approves within minutes to a day.
4. Copy each approved template's **Content SID** (starts with `HX`).
5. Set one environment variable in Vercel, with every approved SID:

   ```
   TWILIO_WHATSAPP_TEMPLATES={"verification_code":"HX…","order_confirmed":"HX…","order_on_the_way":"HX…","order_ready_pickup":"HX…","order_ready_table":"HX…","reservation_table_ready":"HX…","order_delivered":"HX…","order_completed":"HX…","reservation_completed":"HX…","reservation_cancelled":"HX…"}
   ```

6. Redeploy.

**What happens before all templates are approved:**
- **A message type without an approved template** is simply not sent on WhatsApp. The app never switches it to SMS, which would add costs you didn't choose.
- **WhatsApp sign-in** is offered to customers only once `verification_code` is approved.
- **For testing with Twilio's WhatsApp sandbox** (which accepts free text), set `TWILIO_WHATSAPP_ALLOW_FREEFORM=true`. **Never set it in production.**

---

## 1. `verification_code`: customer sign-in code

- **Category:** Authentication
- **Twilio content type:** *WhatsApp authentication* (Meta writes the wording for authentication templates)
- **Options:** add the security recommendation; code expiry **10 minutes**; button **Copy code**
- **Variable:** `{{1}}` = the 6-digit code (sample: `482913`)

## Order updates

- **Category:** Utility
- **Content type:** Text
- **Variables (the same in every template):**
  - `{{1}}` restaurant name (sample: `Opus Bar`)
  - `{{2}}` order reference (sample: `AB12CD`)
  - `{{3}}` link to the order (sample: `https://awamenu.com/opusbar/order/cmx123`)

Keep the wording **exactly** as below; the SMS version uses the same text.

### 2. `order_confirmed`
```
{{1}}: order #{{2}} is confirmed and we've started on it. Track it here: {{3}}
```

### 3. `order_on_the_way` (delivery orders, when ready)
```
{{1}}: order #{{2}} is packed and on its way to you. Track it here: {{3}}
```

### 4. `order_ready_pickup`
```
{{1}}: order #{{2}} is ready for pickup. Show this reference when you arrive: {{3}}
```

### 5. `order_ready_table` (dine-in)
```
{{1}}: order #{{2}} is ready and coming to your table. Details: {{3}}
```

### 6. `reservation_table_ready`
```
{{1}}: order #{{2}}: your table is ready. Details: {{3}}
```

### 7. `order_delivered`
```
{{1}}: order #{{2}} has been delivered. Enjoy! Rate your order: {{3}}
```

### 8. `order_completed`
```
{{1}}: order #{{2}} is complete. Thank you for ordering. Rate your order: {{3}}
```

### 9. `reservation_completed`
```
{{1}}: order #{{2}}: your reservation is complete. Thank you for visiting. Rate it here: {{3}}
```

### 10. `reservation_cancelled` (sent when the restaurant cancels a booking)
```
{{1}}: your table booking #{{2}} has been cancelled by the restaurant. See the reason and any refund here: {{3}}
```

---

## Notes

- **Business verification:** your WhatsApp sender (`TWILIO_WHATSAPP_FROM`) must be a Meta-verified business number, not the sandbox number, before templates can be used in production.
- **Changing wording:** if Meta asks you to change the wording, change it in `lib/order-messaging.ts` (`composeMessage`) too, so the SMS text matches.
- **Pricing:** Meta charges per conversation. Utility templates are cheaper than marketing ones, and these are all utility or authentication.
