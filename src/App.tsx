import './App.css';
import { useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User
} from 'firebase/auth';
import {
  addDoc, collection, doc, getDoc, getDocs,
  onSnapshot, orderBy, query, serverTimestamp,
  setDoc, where
} from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  Home, Trophy, Swords, Medal, UserCircle,
  LogOut, Plus, LockKeyhole, RefreshCw
} from 'lucide-react';

type Tab = 'Home' | 'Tournaments' | 'My Matches' | 'Leaderboard' | 'Profile';

type Player = {
  playerName: string;
  ffUid: string;
  whatsapp: string;
  email: string;
};

type Tournament = {
  id: string;
  title: string;
  game: string;
  mode: string;
  dateText: string;
  entryFee: string;
  prizePool: string;
  slots: number;
  status: string;
  createdAt?: any;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>('Home');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [ffUid, setFfUid] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [myIds, setMyIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [create, setCreate] = useState(false);

  const [title, setTitle] = useState('');
  const [dateText, setDateText] = useState('');
  const [fee, setFee] = useState('15');
  const [prize, setPrize] = useState('500');
  const [slots, setSlots] = useState('48');
  const [gameMode, setGameMode] = useState('Squad');

  const joined = useMemo(() => new Set(myIds), [myIds]);

  useEffect(() => onAuthStateChanged(auth, async u => {
    setUser(u);
    setLoading(false);
    setError('');

    if (!u) {
      setPlayer(null);
      setAdmin(false);
      setMyIds([]);
      return;
    }

    try {
      const [p, a] = await Promise.all([
        getDoc(doc(db, 'players', u.uid)),
        getDoc(doc(db, 'admins', u.uid))
      ]);

      setPlayer(
        p.exists()
          ? p.data() as Player
          : {
              playerName: u.displayName || '',
              ffUid: '',
              whatsapp: '',
              email: u.email || ''
            }
      );

      setAdmin(
        a.exists() &&
        a.data().role === 'admin' &&
        a.data().active === true
      );

      const r = await getDocs(
        query(collection(db, 'registrations'), where('uid', '==', u.uid))
      );

      setMyIds(r.docs.map(x => x.data().tournamentId));
    } catch (e: any) {
      setError('Firebase access issue: ' + e.message);
    }
  }), []);

  useEffect(() => {
    if (!user) return;

    return onSnapshot(
      query(collection(db, 'tournaments'), orderBy('createdAt', 'desc')),
      s => setTournaments(
        s.docs.map(d => ({ id: d.id, ...d.data() } as Tournament))
      ),
      e => setError(e.message)
    );
  }, [user]);

  async function authSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      if (mode === 'signup') {
        const c = await createUserWithEmailAndPassword(
          auth, email.trim(), password
        );

        if (playerName.trim()) {
          await updateProfile(c.user, {
            displayName: playerName.trim()
          });
        }

        await setDoc(doc(db, 'players', c.user.uid), {
          playerName: playerName.trim(),
          ffUid: '',
          whatsapp: '',
          email: email.trim(),
          createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(
          auth, email.trim(), password
        );
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    if (!user) return;
    setBusy(true);

    try {
      const p = {
        playerName: playerName.trim(),
        ffUid: ffUid.trim(),
        whatsapp: whatsapp.trim(),
        email: user.email || ''
      };

      await setDoc(
        doc(db, 'players', user.uid),
        p,
        { merge: true }
      );

      if (p.playerName) {
        await updateProfile(user, {
          displayName: p.playerName
        });
      }

      setPlayer(p);
      alert('Profile saved');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function join(t: Tournament) {
    if (!user) return;

    if (!player?.playerName || !player?.ffUid || !player?.whatsapp) {
      setTab('Profile');
      setError('Complete your player profile first.');
      return;
    }

    setBusy(true);

    try {
      await setDoc(
        doc(db, 'registrations', `${t.id}_${user.uid}`),
        {
          tournamentId: t.id,
          uid: user.uid,
          playerName: player.playerName,
          ffUid: player.ffUid,
          whatsapp: player.whatsapp,
          createdAt: serverTimestamp()
        }
      );

      setMyIds(x =>
        x.includes(t.id) ? x : [...x, t.id]
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function createTournament(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      await addDoc(collection(db, 'tournaments'), {
        title: title.trim(),
        game: 'Free Fire MAX',
        mode: gameMode,
        dateText,
        entryFee: fee,
        prizePool: prize,
        slots: Number(slots),
        status: 'Open',
        createdAt: serverTimestamp()
      });

      setCreate(false);
      setTitle('');
      setDateText('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    if (!user) return;

    try {
      const r = await getDocs(
        query(collection(db, 'registrations'), where('uid', '==', user.uid))
      );

      setMyIds(r.docs.map(x => x.data().tournamentId));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function room(t: Tournament) {
    const roomId = prompt('Room ID');
    if (roomId === null) return;

    const roomPassword = prompt('Room password');
    if (roomPassword === null) return;

    try {
      await setDoc(doc(db, 'roomDetails', t.id), {
        tournamentId: t.id,
        roomId,
        roomPassword,
        updatedAt: serverTimestamp()
      });
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) {
    return <div className="loading">
      S<span>2K</span> ESPORTS
      <small>Loading...</small>
    </div>;
  }

  if (!user) {
    return (
      <main className="auth">
        <div className="logo">S<span>2</span>K</div>
        <p className="eyebrow">SKILL • DOMINANCE • PRECISION</p>
        <h2 className="brand-name">S2K</h2> <h1>ENTER THE<br /><span>ARENA.</span></h1>
        <p className="muted">Your Free Fire tournament hub.</p>

        <form className="panel form" onSubmit={authSubmit}>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create player account'}</h2>

          {mode === 'signup' && (
            <input
              placeholder="Player name"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              required
            />
          )}

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={6}
            required
          />

          {error && <p className="error">{error}</p>}

          <button className="primary" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'login' ? 'LOGIN' : 'SIGN UP'}
          </button>

          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
            }}
          >
            {mode === 'login'
              ? 'New player? Create account'
              : 'Already registered? Login'}
          </button>
        </form>
      </main>
    );
  }

  const nav: { name: Tab; icon: any }[] = [
    { name: 'Home', icon: Home },
    { name: 'Tournaments', icon: Trophy },
    { name: 'My Matches', icon: Swords },
    { name: 'Leaderboard', icon: Medal },
    { name: 'Profile', icon: UserCircle }
  ];

  const my = tournaments.filter(t => joined.has(t.id));

  return (
    <div className="shell">
      <header>
        <div className="brand">S<span>2</span>K <small>ESPORTS</small></div>

        <div className="headright">
          {admin && (
            <b className="admin">
              <LockKeyhole size={12} /> ADMIN
            </b>
          )}
          <button className="logout" onClick={() => signOut(auth)}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main>
        {error && (
          <div className="errorbox">
            {error}
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {tab === 'Home' && (
          <>
            <section className="hero">
              <p className="eyebrow">WELCOME TO THE BATTLEFIELD</p>
              <h1>PLAY HARD.<br /><span>WIN BIG.</span></h1>
              <p>Compete. Dominate. Make your mark.</p>
              <button className="primary" onClick={() => setTab('Tournaments')}>
                EXPLORE TOURNAMENTS
              </button>
            </section>

            <h2 className="section">YOUR OVERVIEW</h2>

            <div className="stats">
              <div className="panel">
                <small>REGISTERED</small>
                <b>{my.length}</b>
                <small>Matches</small>
              </div>
              <div className="panel">
                <small>GAME</small>
                <b>FF</b>
                <small>Free Fire MAX</small>
              </div>
              <div className="panel">
                <small>STATUS</small>
                <b className="green">LIVE</b>
                <small>Compete now</small>
              </div>
            </div>

            <h2 className="section">FEATURED TOURNAMENTS</h2>

            <div className="cards">
              {tournaments.slice(0, 2).map(t => (
                <TournamentCard
                  key={t.id}
                  t={t}
                  joined={joined.has(t.id)}
                  onJoin={() => join(t)}
                  busy={busy}
                  admin={admin}
                  onRoom={() => room(t)}
                />
              ))}
            </div>
          </>
)}

        {tab === 'Tournaments' && (
          <>
            <div className="heading">
              <p className="eyebrow">S2K COMPETITIVE SERIES</p>
              <h1>TOURNAMENTS<span>.</span></h1>
              <p className="muted">Choose your battlefield.</p>
            </div>

            {admin && (
              <button className="primary" onClick={() => setCreate(!create)}>
                <Plus size={16} /> CREATE TOURNAMENT
              </button>
            )}

            {create && (
             <>
             <form className="panel form" onSubmit={createTournament}>
                
<h3 className="form-heading">CREATE YOUR TOURNAMENT</h3>
<p className="form-subtitle">Set up your next S2K battle</p>

<div className="form-grid">
  <label className="form-field full">
    <span>TOURNAMENT NAME</span>
    <input
      placeholder="Enter tournament name"
      value={title}
      onChange={e => setTitle(e.target.value)}
      required
    />
  </label>

  <label className="form-field">
    <span>MATCH DATE & TIME</span>
    <input
      type="datetime-local"
      value={dateText}
      onChange={e => setDateText(e.target.value)}
      required
    />
  </label>

  <label className="form-field">
    <span>GAME MODE</span>
    <select
      value={gameMode}
      onChange={e => setGameMode(e.target.value)}
    >
      <option>Squad</option>
      <option>Duo</option>
      <option>Solo</option>
    </select>
  </label>

  <label className="form-field">
    <span>ENTRY FEE (₹)</span>
    <input
      type="number"
      min="0"
      placeholder="e.g. 15"
      value={fee}
      onChange={e => setFee(e.target.value)}
      required
    />
  </label>

  <label className="form-field">
    <span>PRIZE POOL (₹)</span>
    <input
      type="number"
      min="0"
      placeholder="e.g. 500"
      value={prize}
      onChange={e => setPrize(e.target.value)}
      required
    />
  </label>

  <label className="form-field full">
    <span>TOTAL TEAM SLOTS</span>
    <input
      type="number"
      min="1"
      placeholder="e.g. 48"
      value={slots}
      onChange={e => setSlots(e.target.value)}
      required
    />
  </label>
</div>

<button
  className="primary create-submit"
  type="submit"
  disabled={busy}
>
  {busy ? "CREATING..." : "⚡ CREATE TOURNAMENT"}
</button>
</form>

            <div className="cards">
              {tournaments.length
                ? tournaments.map(t => (
                    <TournamentCard
                      key={t.id}
                      t={t}
                      joined={joined.has(t.id)}
                      onJoin={() => join(t)}
                      busy={busy}
                      admin={admin}
                      onRoom={() => room(t)}
                    />
                  ))
                : <Empty text="No tournaments yet. Check back soon." />
              }
            </div>
            </>
        )}
</>
)}
        {tab === 'My Matches' && (
          <>
            <div className="heading">
              <p className="eyebrow">YOUR COMPETITIONS</p>
              <h1>MY MATCHES<span>.</span></h1>
            </div>
            <button className="refresh" onClick={refresh}>
              <RefreshCw size={14} /> REFRESH
            </button>
            <div className="cards">
              {my.length
                ? my.map(t => (
                    <TournamentCard
                      key={t.id}
                      t={t}
                      joined
                      onJoin={() => {}}
                      busy={busy}
                      admin={admin}
                      onRoom={() => room(t)}
                      showRoom
                    />
                  ))
                : <Empty text="You haven't joined any tournaments yet." />
              }
            </div>
          </>
        )}

        {tab === 'Leaderboard' && (
          <>
            <div className="heading">
              <p className="eyebrow">TOP COMPETITORS</p>
              <h1>LEADERBOARD<span>.</span></h1>
            </div>
            <Empty text="Leaderboard will appear after S2K admins publish verified match results." />
          </>
        )}

        {tab === 'Profile' && (
          <>
            <div className="heading">
              <p className="eyebrow">PLAYER IDENTITY</p>
              <h1>YOUR PROFILE<span>.</span></h1>
            </div>

            <div className="panel form profile">
              <div className="avatar">
                {(player?.playerName || user.email || 'P').charAt(0).toUpperCase()}
              </div>
              <h2>{player?.playerName || 'S2K PLAYER'}</h2>
              <p className="muted">{user.email}</p>

              <label>PLAYER NAME</label>
              <input
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="In-game name"
              />

              <label>FREE FIRE UID</label>
              <input
                value={ffUid}
                onChange={e => setFfUid(e.target.value)}
                placeholder="Free Fire UID"
              />

              <label>WHATSAPP NUMBER</label>
              <input
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="WhatsApp number"
                inputMode="numeric"
              />

              <button className="primary" onClick={saveProfile} disabled={busy}>
                SAVE PROFILE
              </button>
            </div>

            {admin && (
              <div className="panel adminnote">
                Admin access active. Create tournaments from the Tournaments tab.
              </div>
            )}
          </>
        )}
      </main>

      <nav>
        {nav.map(n => (
          <button
            key={n.name}
            className={tab === n.name ? 'active' : ''}
            onClick={() => {
              setTab(n.name);
              setCreate(false);
            }}
          >
            <n.icon size={19} />
            <span>{n.name}</span>
          </button>
        ))}
      </nav>

      <footer>S2K ESPORTS • SKILL. DOMINANCE. PRECISION.</footer>
    </div>
  );
}

function TournamentCard({
  t, joined, onJoin, busy, admin, onRoom, showRoom = false
}: {
  t: Tournament;
  joined: boolean;
  onJoin: () => void;
  busy: boolean;
  admin: boolean;
  onRoom: () => void;
  showRoom?: boolean;
}) {
  const [room, setRoom] = useState<{ roomId: string; roomPassword: string } | null>(null);

  useEffect(() => {
    if (!showRoom) return;
    let alive = true;
    getDoc(doc(db, 'roomDetails', t.id))
      .then(s => {
        if (alive && s.exists()) setRoom(s.data() as any);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [showRoom, t.id]);

  return (
    <article className="panel tournament">
      <div className="topline">
        <span className="tag">FREE FIRE MAX</span>
        <span className="status">{t.status || 'Open'}</span>
      </div>

      <h3>{t.title}</h3>
      <p className="muted">{t.mode} • {t.dateText || 'Date TBA'}</p>

      <div className="numbers">
        <div><small>ENTRY</small><b>₹{t.entryFee}</b></div>
        <div><small>PRIZE POOL</small><b>₹{t.prizePool}</b></div>
        <div><small>SLOTS</small><b>{t.slots}</b></div>
      </div>

      {showRoom && room && (
        <div className="room">
          <b>ROOM ID: {room.roomId}</b>
          <b>PASSWORD: {room.roomPassword}</b>
        </div>
      )}

      <div className="actions">
        {joined
          ? <button className="joined" disabled>✓ REGISTERED</button>
          : <button className="primary" onClick={onJoin} disabled={busy || t.status !== 'Open'}>
              REGISTER SQUAD
            </button>
        }
        {admin && <button className="outline" onClick={onRoom}>ROOM DETAILS</button>}
      </div>
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="panel empty">
      <Trophy size={26} />
      <p>{text}</p>
    </div>
  );
}
