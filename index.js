/*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    import 'dotenv/config';
    import express from "express";
import path from "path";
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { AuditLog } from './models/AuditLog.js';
import session from "express-session";
import flash from "connect-flash";
import router from "./routes/index.js";
import adminRouter from './routes/admin.js';
import ensureAdmin from './middleware/ensureAdmin.js';
import { adminSidePage } from './controllers/adminController.js';
import { sequelize } from "./models/db.js";
import fs from 'fs';
import hbs from "hbs";
import { User } from "./models/userModel.js";
import { Profile } from "./models/Profile.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));

app.use(session({
  secret: process.env.SESSION_SECRET || "xianfire-secret-key",
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

app.engine("xian", async (filePath, options, callback) => {
  try {
     const originalPartialsDir = hbs.partialsDir;
    hbs.partialsDir = path.join(__dirname, 'views');

    const result = await new Promise((resolve, reject) => {
      hbs.__express(filePath, options, (err, html) => {
        if (err) return reject(err);
        resolve(html);
      });
    });

    hbs.partialsDir = originalPartialsDir;
    callback(null, result);
  } catch (err) {
    callback(err);
  }
});
app.use(async (req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  // Cache-busting version for CSS during development
  res.locals.cssVersion = Date.now();

  // Provide current user/profile to templates if session exists
  res.locals.currentUser = null;
  res.locals.currentUserJson = 'null';
  res.locals.profileJson = 'null';
  res.locals.profile = null;
  // initialize in-memory per-tab session store (token -> { userId, expires })
  if (!global.__tabSessions) global.__tabSessions = {};

  // helper to get effective userId for this request: prefer tab-token auth then cookie session
  req.getUserId = function() {
    return this._tabUserId || (this.session && this.session.userId) || null;
  };
  try {
    // If a tab token is provided (query param `tab` or header `x-tab-token`), try to authenticate using it.
    const tabToken = (req.query && req.query.tab) || req.headers['x-tab-token'] || null;
    if (tabToken) {
      const entry = global.__tabSessions[tabToken];
      if (entry && entry.userId && (!entry.expires || entry.expires > Date.now())) {
        // set a per-request tab user id (does not modify cookie/session store)
        req._tabUserId = entry.userId;
        // load user/profile for templates
        const u = await User.findByPk(entry.userId, { attributes: ['id','name','email'] });
        if (u) {
          res.locals.currentUser = { id: u.id, name: u.name, email: u.email };
          res.locals.currentUserJson = JSON.stringify(res.locals.currentUser);
          const p = await Profile.findOne({ where: { userId: u.id } });
          if (p) res.locals.profile = p.toJSON();
          if (p) res.locals.profileJson = JSON.stringify(res.locals.profile);
        }
      }
    }

    // Fallback to cookie session if no tab token auth succeeded
    if (!res.locals.currentUser && req.session && req.session.userId) {
      const u = await User.findByPk(req.session.userId, { attributes: ['id','name','email'] });
      if (u) {
        res.locals.currentUser = { id: u.id, name: u.name, email: u.email };
        res.locals.currentUserJson = JSON.stringify(res.locals.currentUser);
        const p = await Profile.findOne({ where: { userId: u.id } });
        if (p) res.locals.profile = p.toJSON();
        if (p) res.locals.profileJson = JSON.stringify(res.locals.profile);
      }
    }
    // Ensure templates can rely on `owner` when a user is authenticated
    if (res.locals.currentUser) {
      res.locals.owner = res.locals.currentUser;
    }
  } catch (err) {
    console.error('Error loading currentUser in middleware', err);
  }

  // In development, try to inline compiled CSS so pages render even if
  // the browser cached an old file or CDN is blocked. This reads
  // ./public/output.css on each request if available.
  try {
    const cssPath = path.join(process.cwd(), 'public', 'output.css');
    if (fs.existsSync(cssPath)) {
      res.locals.inlineCss = fs.readFileSync(cssPath, 'utf8');
    } else {
      res.locals.inlineCss = null;
    }
  } catch (err) {
    res.locals.inlineCss = null;
  }

  next();
});


app.set("views", path.join(__dirname, "views"));
app.set("view engine", "xian");
const partialsDir = path.join(__dirname, "views/partials");
fs.readdir(partialsDir, (err, files) => {
  if (err) {
    console.error("❌ Could not read partials directory:", err);
    return;
  }

   files
    .filter(file => file.endsWith('.xian'))
    .forEach(file => {
      const partialName = file.replace('.xian', ''); 
      const fullPath = path.join(partialsDir, file);

      fs.readFile(fullPath, 'utf8', (err, content) => {
        if (err) {
          console.error(`❌ Failed to read partial: ${file}`, err);
          return;
        }
        hbs.registerPartial(partialName, content);
        
      });
    });

// Register a small helper to compare values in templates
hbs.registerHelper('ifEquals', function(a, b, options) {
  try {
    return String(a) === String(b) ? options.fn(this) : options.inverse(this);
  } catch (err) {
    return options.inverse(this);
  }
});
// unlessEquals: inverse of ifEquals
hbs.registerHelper('unlessEquals', function(a, b, options) {
  try {
    return String(a) !== String(b) ? options.fn(this) : options.inverse(this);
  } catch (err) {
    return options.inverse(this);
  }
});
// Helper to check substring presence (used for media type checks)
hbs.registerHelper('contains', function(str, substr, options) {
  // Support both block usage `{{#contains str substr}}...{{/contains}}`
  // and subexpression/inline usage `{{#if (contains str substr)}}...{{/if}}`.
  try {
    const found = !!(str && substr && String(str).indexOf(String(substr)) !== -1);
    // If called as block helper, options will be an object with fn/inverse.
    if (options && typeof options === 'object' && typeof options.fn === 'function') {
      return found ? options.fn(this) : options.inverse(this);
    }
    // Called inline/subexpression: return boolean
    return found;
  } catch (err) {
    if (options && typeof options === 'object' && typeof options.inverse === 'function') {
      return options.inverse(this);
    }
    return false;
  }
});
// Split helper: returns array by splitting a string on delimiter and trimming parts
hbs.registerHelper('split', function(str, delim) {
  try {
    if (!str || typeof str !== 'string') return [];
    const d = (typeof delim === 'string' && delim.length > 0) ? delim : ',';
    return String(str).split(d).map(s => s.trim()).filter(Boolean);
  } catch (err) {
    return [];
  }
});
// Parse JSON stored as string (safe). Returns object/array or empty array on failure.
hbs.registerHelper('jsonParse', function(str) {
  try {
    if (!str) return [];
    if (typeof str === 'object') return str; // already parsed
    return JSON.parse(str);
  } catch (err) {
    return [];
  }
});
// Greater-than helper for templates: {{#ifGt a b}}...{{/ifGt}}
hbs.registerHelper('ifGt', function(a, b, options) {
  try {
    return Number(a) > Number(b) ? options.fn(this) : options.inverse(this);
  } catch (err) {
    return options.inverse(this);
  }
});

// simple increment/decrement helpers: {{inc n}} {{dec n}}
hbs.registerHelper('inc', function(v) { return Number(v) + 1; });
hbs.registerHelper('dec', function(v) { return Number(v) - 1; });
});

app.use("/", router);
app.use('/admin', adminRouter);

app.get('/adminside', ensureAdmin, adminSidePage);

export default app;

// Start server with graceful handling for EADDRINUSE (port already in use).
function tryListen(port, attemptsLeft = 5) {
  // Create HTTP server and attach Socket.IO for signaling
  const server = http.createServer(app);

  // Attach Socket.IO to the HTTP server
  const io = new SocketIOServer(server, {
    /* default options; same-origin served client will use /socket.io/socket.io.js */
  });

  io.on('connection', (socket) => {
    // map of userId -> socket.id maintained in-memory for direct signaling
    // (note: this is ephemeral and resets when the node process restarts)
    if (!global.__userSocketMap) global.__userSocketMap = new Map();
    const userSocketMap = global.__userSocketMap;

    // allow clients to register their userId so we can target them directly
    socket.on('register', (payload) => {
      try {
        const userId = payload && payload.userId;
        if (userId) {
          userSocketMap.set(String(userId), socket.id);
          socket.userId = String(userId);
        }
      } catch (err) { console.error('register error', err); }
    });

    socket.on('disconnect', () => {
      try { if (socket.userId) userSocketMap.delete(String(socket.userId)); } catch(e){}
    });
    // Join a call room
    socket.on('join-call', (room) => {
      try {
        socket.join(room);
        // Notify other peers in the room that a peer joined
        socket.to(room).emit('peer-joined');
      } catch (err) {
        console.error('join-call error', err);
      }
    });

    // Caller can send a directed call request to another user id
    socket.on('call-request', async (payload) => {
      try {
        const { toUserId, fromUserId, room } = payload || {};
        if (!toUserId) return;
        const targetSocketId = userSocketMap.get(String(toUserId));
        if (targetSocketId) {
          io.to(targetSocketId).emit('incoming-call', { fromUserId, room });
        }
        try { await AuditLog.create({ actorUserId: fromUserId || null, action: 'call_requested', targetType: 'User', targetId: toUserId || null, details: { room } }); } catch(e){}
      } catch (err) { console.error('call-request error', err); }
    });

    // Recipient accepts the call
    socket.on('call-accept', async (payload) => {
      try {
        const { toUserId, fromUserId, room } = payload || {};
        // notify caller (fromUserId) that the call was accepted
        const callerSocketId = userSocketMap.get(String(fromUserId));
        if (callerSocketId) io.to(callerSocketId).emit('call-accepted', { fromUserId: socket.userId, room });
        try { await AuditLog.create({ actorUserId: socket.userId || null, action: 'call_accepted', targetType: 'User', targetId: fromUserId || null, details: { room } }); } catch(e){}
      } catch (err) { console.error('call-accept error', err); }
    });

    socket.on('call-end', async (payload) => {
      try {
        const { fromUserId, toUserId, room } = payload || {};
        // notify other side that call ended
        if (toUserId) {
          const s = userSocketMap.get(String(toUserId)); if (s) io.to(s).emit('call-ended', { fromUserId, room });
        }
        try { await AuditLog.create({ actorUserId: socket.userId || null, action: 'call_ended', targetType: 'User', targetId: toUserId || null, details: { room } }); } catch(e){}
      } catch (err) { console.error('call-end error', err); }
    });

    // Relay offer to other peers in the room
    socket.on('offer', (payload) => {
      try {
        const { room, sdp } = payload || {};
        if (room) socket.to(room).emit('offer', sdp);
      } catch (err) { console.error('offer relay error', err); }
    });

    // Relay answer to other peers in the room
    socket.on('answer', (payload) => {
      try {
        const { room, sdp } = payload || {};
        if (room) socket.to(room).emit('answer', sdp);
      } catch (err) { console.error('answer relay error', err); }
    });

    // Relay ICE candidates
    socket.on('ice-candidate', (payload) => {
      try {
        const { room, candidate } = payload || {};
        if (room) socket.to(room).emit('ice-candidate', candidate);
      } catch (err) { console.error('ice relay error', err); }
    });
  });

  server.listen(port, () => {
    console.log(`🔥 XianFire running at http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${port} is already in use.`);
      if (attemptsLeft > 0) {
        const nextPort = port + 1;
        console.log(`Trying port ${nextPort} (attempts left: ${attemptsLeft - 1})...`);
        // slight delay before retrying
        setTimeout(() => tryListen(nextPort, attemptsLeft - 1), 300);
      } else {
        console.error('❌ Could not bind to a free port. Exiting.');
        process.exit(1);
      }
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });

  return server;
}

// Sync DB models once on startup with alter in development so new columns are added safely.
// This avoids keeping a sync() call inside controllers and ensures models are registered before altering.
(async () => {
  try {
    const syncOptions = process.env.NODE_ENV === 'production' ? {} : { alter: true };
    if (!process.env.VERCEL) {
      await sequelize.sync(syncOptions);
      if (!process.env.ELECTRON) {
        tryListen(PORT, 5);
      }
    }
  } catch (err) {
    console.error('Failed to sync database:', err);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
})();
