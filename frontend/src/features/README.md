# Frontend source map

`main.jsx` boots the app and `app/App.jsx` owns the route table. `app/Shell.jsx` contains the shared layout. Supporting app modules have focused names: `api.js`, `auth.jsx`, `notifications.jsx`, `property-tools.jsx`, `formatters.js`, `motion.js`, and `chat-updates.js`.

Route components live in a `pages/` folder inside their feature. `app/App.jsx` imports them from the files that implement them, without an extra re-export layer. Dashboards and reusable components use clearly named folders.

| Feature         | Entry points                                                                         |
| --------------- | ------------------------------------------------------------------------------------ |
| `access/`       | `protected-route.jsx`: protected route wrapper                                       |
| `account/`      | `pages/`: account, profile, and contact                                              |
| `admin/`        | `dashboard/admin-dashboard.jsx`                                                      |
| `buyer/`        | `pages/`: saved homes, search alerts, and home comparison                            |
| `interactions/` | `pages/`: chats, inbox, leads, notifications, and viewings                           |
| `marketplace/`  | `pages/`: marketplace routes; `components/`: shared property cards                   |
| `seller/`       | `dashboard/seller-dashboard.jsx`; `pages/listing-form.jsx`: create and edit listings |

The buyer experience does not have a standalone dashboard screen. The dedicated tools are grouped under `buyer/`; shared workflows remain under `interactions/`.

Styles are imported in `main.jsx`: `styles/base.css` holds shared rules, and `styles/features/` contains feature-specific stylesheets.
