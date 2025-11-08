'use client';
import { useEffect, useState } from 'react';
import { csrfFetch } from '@/lib/csrf-client';

type Block = { start: string; end: string; label?: string };
function EmptyRow(): Block { return { start: '10:00', end: '12:00', label: '' }; }

export default function AdminSettings() {
  // schedule
  const [activeFrom, setActiveFrom] = useState<string>(new Date().toISOString().slice(0,10));
  const [rows, setRows] = useState<Block[]>([EmptyRow(), { start: '19:00', end: '21:00', label: 'Evening' }]);
  const [overrideDate, setOverrideDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [overrideRows, setOverrideRows] = useState<Block[]>([EmptyRow()]);
  const [loading, setLoading] = useState(false);

  // admin manage
  const [users, setUsers] = useState<any[]>([]);
  const [allow, setAllow] = useState<any[]>([]);
  const [email, setEmail] = useState('');

  async function load() {
    const s = await fetch('/api/admin/schedule', { cache: 'no-store' }).then(r=>r.json());
    if (s.template?.blocks) setRows(s.template.blocks);

    const u = await fetch('/api/admin/users', { cache: 'no-store' }).then(r=>r.json());
    setUsers(u.users ?? []); setAllow(u.allowlist ?? []);
  }

  useEffect(()=>{ load(); },[]);

  function setRow(i: number, v: Partial<Block>) {
    setRows(r => r.map((x, idx) => idx===i? {...x, ...v}: x));
  }
  function setORow(i: number, v: Partial<Block>) {
    setOverrideRows(r => r.map((x, idx) => idx===i? {...x, ...v}: x));
  }

  async function saveTemplate() {
    setLoading(true);
    const r = await csrfFetch('/api/admin/schedule', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ activeFrom, blocks: rows })
    });
    setLoading(false);
    if (!r.ok) alert('Save failed'); else alert('Saved');
  }

  async function saveOverride(del=false) {
    setLoading(true);
    const r = await csrfFetch('/api/admin/schedule/override', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(del ? { date: overrideDate, delete: true } : { date: overrideDate, blocks: overrideRows })
    });
    setLoading(false);
    if (!r.ok) alert('Failed'); else alert(del ? 'Override removed' : 'Override saved');
  }

  async function action(action: string, email: string, blocked?: boolean) {
    const r = await csrfFetch('/api/admin/users', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action, email, blocked })
    });
    if (!r.ok) { alert('Failed'); return; }
    await load();
  }

  return (
    <div className="space-y-8">
      {/* Schedule template */}
      <section className="bg-card rounded-2xl p-4 border border-neutral-800">
        <h2 className="font-bold mb-3">Default daily schedule</h2>
        <div className="flex items-center gap-3 mb-3 text-sm">
          <label className="text-subtle">Active from</label>
          <input type="date" className="bg-[#0f0f13] border border-neutral-800 rounded-xl p-2 focus-ring"
                 value={activeFrom} onChange={e=>setActiveFrom(e.target.value)} />
          <button className="btn-secondary focus-ring text-xs" onClick={()=>setRows(r=>[...r, EmptyRow()])}>+ Add row</button>
        </div>
        <div className="space-y-2">
          {rows.map((b,i)=>(
            <div key={i} className="flex items-center gap-2 text-sm">
              <input value={b.label ?? ''} onChange={e=>setRow(i,{label:e.target.value})}
                     placeholder="Label (optional)" className="bg-[#0f0f13] border border-neutral-800 rounded-xl p-2 focus-ring w-36" />
              <input value={b.start} onChange={e=>setRow(i,{start:e.target.value})}
                     className="bg-[#0f0f13] border border-neutral-800 rounded-xl p-2 focus-ring w-24" placeholder="HH:MM"/>
              <span>–</span>
              <input value={b.end} onChange={e=>setRow(i,{end:e.target.value})}
                     className="bg-[#0f0f13] border border-neutral-800 rounded-xl p-2 focus-ring w-24" placeholder="HH:MM"/>
              <button className="btn-secondary focus-ring text-xs" onClick={()=>setRows(r=>r.filter((_,x)=>x!==i))}>Remove</button>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <button className="btn-primary focus-ring" onClick={saveTemplate} disabled={loading}>{loading?'Saving…':'Save template'}</button>
        </div>
      </section>

      {/* One-day override */}
      <section className="bg-card rounded-2xl p-4 border border-neutral-800">
        <h2 className="font-bold mb-3">Override a date</h2>
        <div className="flex items-center gap-3 mb-3 text-sm">
          <input type="date" className="bg-[#0f0f13] border border-neutral-800 rounded-xl p-2 focus-ring"
                 value={overrideDate} onChange={e=>setOverrideDate(e.target.value)} />
          <button className="btn-secondary focus-ring text-xs" onClick={()=>setOverrideRows(r=>[...r, EmptyRow()])}>+ Add row</button>
        </div>
        <div className="space-y-2">
          {overrideRows.map((b,i)=>(
            <div key={i} className="flex items-center gap-2 text-sm">
              <input value={b.label ?? ''} onChange={e=>setORow(i,{label:e.target.value})}
                     placeholder="Label" className="bg-[#0f0f13] border border-neutral-800 rounded-xl p-2 focus-ring w-36" />
              <input value={b.start} onChange={e=>setORow(i,{start:e.target.value})}
                     className="bg-[#0f0f13] border border-neutral-800 rounded-xl p-2 focus-ring w-24" placeholder="HH:MM"/>
              <span>–</span>
              <input value={b.end} onChange={e=>setORow(i,{end:e.target.value})}
                     className="bg-[#0f0f13] border border-neutral-800 rounded-xl p-2 focus-ring w-24" placeholder="HH:MM"/>
              <button className="btn-secondary focus-ring text-xs" onClick={()=>setOverrideRows(r=>r.filter((_,x)=>x!==i))}>Remove</button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn-primary focus-ring" onClick={()=>saveOverride(false)} disabled={loading}>{loading?'Saving…':'Save override'}</button>
          <button className="btn-secondary focus-ring" onClick={()=>saveOverride(true)} disabled={loading}>Remove override</button>
        </div>
      </section>

      {/* Admin & users */}
      <section className="bg-card rounded-2xl p-4 border border-neutral-800">
        <h2 className="font-bold mb-3">Admin & user management</h2>

        <div className="flex items-center gap-2 mb-3">
          <input className="bg-[#0f0f13] border border-neutral-800 rounded-xl p-2 focus-ring text-sm"
                 placeholder="email@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
          <button className="btn-secondary focus-ring text-xs" onClick={()=>action('allowlist:add', email)}>Add to admin allow-list</button>
          <button className="btn-secondary focus-ring text-xs" onClick={()=>action('allowlist:remove', email)}>Remove from allow-list</button>
          <button className="btn-secondary focus-ring text-xs" onClick={()=>action('admin:promote', email)}>Promote now</button>
          <button className="btn-secondary focus-ring text-xs" onClick={()=>action('admin:demote', email)}>Demote</button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="text-subtle text-sm mb-2">Admins / Users</div>
            <ul className="space-y-2 text-sm">
              {users.map((u:any)=>(
                <li key={u.email} className="border border-neutral-800 rounded-xl p-2 flex items-center justify-between">
                  <span>{u.display_name ?? u.email} <span className="text-subtle">({u.email})</span></span>
                  <span className="flex items-center gap-2">
                    {u.is_admin && <span className="pill">Admin</span>}
                    {u.is_blocked && <span className="pill">Blocked</span>}
                    <button className="btn-secondary focus-ring text-xs" onClick={()=>action('user:block', u.email, !u.is_blocked)}>
                      {u.is_blocked ? 'Unblock' : 'Block'}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-subtle text-sm mb-2">Allow-listed emails</div>
            <ul className="space-y-2 text-sm">
              {allow.map((a:any)=>(
                <li key={a.email} className="border border-neutral-800 rounded-xl p-2 flex items-center justify-between">
                  <span>{a.email}</span>
                  <button className="btn-secondary focus-ring text-xs" onClick={()=>action('allowlist:remove', a.email)}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
