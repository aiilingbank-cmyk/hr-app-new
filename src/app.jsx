import React, { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

/* ========== Utils ========== */
const ls = { get:(k,f)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):f; }catch{return f;} }, set:(k,v)=>localStorage.setItem(k, JSON.stringify(v)) };
const fmtDate = (d)=> new Date(d).toISOString().slice(0,10);
const toLocal = (dt)=> new Date(dt).toLocaleString();
const parseHM = (s)=>{ const [h,m]=s.split(":").map(Number); return h*60+(m||0); };
const minutesToHM = (m)=>{ const sign=m<0?"-":""; m=Math.abs(Math.round(m)); return `${sign}${Math.floor(m/60)}h ${m%60}m`; };
const csv = (rows)=> rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
function downloadCSV(rows, filename){ const blob=new Blob([csv(rows)],{type:"text/csv;charset=utf-8;"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function haversineDistance(lat1, lon1, lat2, lon2){ const R=6371e3,toRad=d=>d*Math.PI/180, dφ=toRad(lat2-lat1), dλ=toRad(lon2-lon1), φ1=toRad(lat1), φ2=toRad(lat2); const a=Math.sin(dφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(dλ/2)**2; return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); }

/* ========== Seeds ========== */
const defaultEmployees = ["คุณแบงค์", "พนักงาน A", "พนักงาน B"];
const defaultShifts = [
  { code:"A", label:"10:00-19:00", start:"10:00", end:"19:00" },
  { code:"B", label:"11:00-20:00", start:"11:00", end:"20:00" },
  { code:"C", label:"12:00-21:00", start:"12:00", end:"21:00" },
];
const defaultBranches = ["สาขากลาง","สาขา A","สาขา B"];
const seedOrg = { orgName:"Demo Store", siteLat:13.7563, siteLng:100.5018, radiusM:200 };

/* ========== Main App ========== */
export default function App(){
  const [tab, setTab] = useState("clock");
  const [org, setOrg] = useState(ls.get("org", seedOrg));
  const [employees, setEmployees] = useState(ls.get("employees", defaultEmployees));
  const [branches, setBranches] = useState(ls.get("branches", defaultBranches));
  const [branchMap, setBranchMap] = useState(ls.get("branchMap", Object.fromEntries(employees.map(e=>[e, branches[0]]))));
  const [shiftMap, setShiftMap] = useState(ls.get("shiftMap", Object.fromEntries(employees.map(e=>[e, defaultShifts[0].code]))));
  const [name, setName] = useState(employees[0]||"");
  const [records, setRecords] = useState(ls.get("records", []));
  const [leaveReqs, setLeaveReqs] = useState(ls.get("leaveReqs", []));

  useEffect(()=>{ ls.set("org",org); },[org]);
  useEffect(()=>{ ls.set("employees",employees); },[employees]);
  useEffect(()=>{ ls.set("branches",branches); },[branches]);
  useEffect(()=>{ ls.set("branchMap",branchMap); },[branchMap]);
  useEffect(()=>{ ls.set("shiftMap",shiftMap); },[shiftMap]);
  useEffect(()=>{ ls.set("records",records); },[records]);
  useEffect(()=>{ ls.set("leaveReqs",leaveReqs); },[leaveReqs]);

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">🧭 HR Mini App — ลงเวลา • ยื่นลา • คิดชั่วโมง • Dashboard</h1>
          <div className="flex flex-wrap gap-2">
            <Tab label="ลงเวลา" active={tab==="clock"} onClick={()=>setTab("clock")} />
            <Tab label="ยื่นลางาน" active={tab==="leave"} onClick={()=>setTab("leave")} />
            <Tab label="สำหรับ HR" active={tab==="admin"} onClick={()=>setTab("admin")} />
            <Tab label="คำนวณชั่วโมง" active={tab==="calc"} onClick={()=>setTab("calc")} />
            <Tab label="แดชบอร์ด" active={tab==="dashboard"} onClick={()=>setTab("dashboard")} />
          </div>
        </header>

        {tab==="clock" && <ClockModule {...{org, setOrg, employees, setEmployees, name, setName, branchMap, setBranchMap, records, setRecords}} />}
        {tab==="leave" && <LeaveModule {...{employees, name, setName, branchMap, leaveReqs, setLeaveReqs}} />}
        {tab==="admin" && <AdminModule {...{org, setOrg, employees, setEmployees, branches, setBranches, branchMap, setBranchMap, shiftMap, setShiftMap, leaveReqs}} />}
        {tab==="calc" && <CalcModule {...{employees, branchMap, shiftMap, records, leaveReqs}} />}
        {tab==="dashboard" && <DashboardModule {...{employees, branchMap, shiftMap, records, leaveReqs}} />}

        <footer className="mt-8 text-center text-xs text-neutral-500">ข้อมูลเก็บในอุปกรณ์ (localStorage) • พร้อมต่อ Google Sheets ได้</footer>
      </div>
    </div>
  );
}

/* ========== UI Helpers ========== */
function Section({ title, right, children }){
  return <section className="bg-white rounded-2xl shadow p-4 md:p-6 mb-6">
    <div className="flex items-center justify-between mb-4">
      <h2 className="font-semibold">{title}</h2>
      {right}
    </div>
    {children}
  </section>
}
function Tab({ label, active, onClick }){
  return <button onClick={onClick} className={`px-3 py-2 rounded-xl text-sm shadow ${active? "bg-black text-white":"bg-white"}`}>{label}</button>
}
function badge(status){ const cls=status==="Approved"?"bg-green-100 text-green-700": status==="Rejected"?"bg-rose-100 text-rose-700":"bg-yellow-100 text-yellow-700"; return <span className={`px-2 py-1 rounded-full text-xs ${cls}`}>{status}</span>; }

/* ========== Modules ========== */
function ClockModule({ org, setOrg, employees, setEmployees, name, setName, branchMap, setBranchMap, records, setRecords }){
  const [pos, setPos] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const vidRef = useRef(null), canvasRef = useRef(null), streamRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(()=>{
    (async ()=>{ try{ const s=await navigator.mediaDevices.getUserMedia({video:true}); streamRef.current=s; if(vidRef.current) vidRef.current.srcObject=s; }catch{} })();
    getPosition(); return ()=>{ if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()); };
  },[]);

  function getPosition(){ if(!("geolocation" in navigator)){ setErr("อุปกรณ์ไม่รองรับพิกัด"); return; }
    navigator.geolocation.getCurrentPosition(p=> setPos({lat:p.coords.latitude, lng:p.coords.longitude, acc:p.coords.accuracy}), e=> setErr("ดึงพิกัดไม่ได้: "+e.message), { enableHighAccuracy:true, timeout:12000, maximumAge:10000 });
  }

  function takePhoto(){
    const v=vidRef.current, c=canvasRef.current; if(!v||!c) return;
    const w=v.videoWidth||640, h=v.videoHeight||480; c.width=w; c.height=h;
    const ctx=c.getContext("2d"); ctx.drawImage(v,0,0,w,h);
    const url=c.toDataURL("image/jpeg",0.9); setPreviewUrl(url); return url;
  }

  const within = useMemo(()=>{
    if(!pos) return null;
    const d=haversineDistance(pos.lat,pos.lng,org.siteLat,org.siteLng);
    return { d, ok: d <= Number(org.radiusM||0) };
  },[pos,org]);

  function addRecord(type){
    setLoading(true); setErr("");
    navigator.geolocation.getCurrentPosition(()=>{
      const photo = takePhoto();
      const rec = { id:crypto.randomUUID(), name, branch: branchMap[name]||"", type, ts:new Date().toISOString(),
        lat:pos?.lat??null, lng:pos?.lng??null, acc:pos?.acc??null, dist: within?Math.round(within.d):null, within: within?within.ok:false, photo };
      setRecords(r=>[rec, ...r]); setLoading(false);
    }, e=>{ setErr("บันทึกไม่สำเร็จ: "+e.message); setLoading(false); }, { enableHighAccuracy:true, timeout:8000 });
  }

  function exportCSV(){
    const header=["id","name","branch","type","timestamp","lat","lng","acc","distance_m","within","photo_dataurl"];
    const rows=[header, ...records.map(r=>[r.id,r.name,r.branch,r.type,r.ts,r.lat,r.lng,r.acc,r.dist,r.within,r.photo])];
    downloadCSV(rows, `timeclock_${fmtDate(new Date())}.csv`);
  }

  return <div className="grid md:grid-cols-2 gap-6">
    <Section title="ลงเวลา (Selfie + พิกัด)"
      right={<div className="flex gap-2">
        <button onClick={exportCSV} className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm">Export CSV</button>
      </div>}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm text-neutral-500">สถานที่ทำงาน</div>
          <div className="font-semibold">{org.orgName}</div>
          <div className="text-xs text-neutral-500">{org.siteLat}, {org.siteLng} • รัศมี {org.radiusM} ม.</div>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold">พิกัดปัจจุบัน</div>
          <div className="text-neutral-600">{pos? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`: "—"}</div>
          <button onClick={getPosition} className="text-xs underline">รีเฟรชพิกัด</button>
        </div>
      </div>
      <div className={`mb-3 text-sm font-medium ${within? (within.ok?"text-green-600":"text-red-600"):"text-neutral-500"}`}>
        {within? (within.ok? `✅ อยู่ในโซน • ระยะ ${Math.round(within.d)} ม.` : `⛔ นอกโซน • ระยะ ${Math.round(within.d)} ม.`) : "กำลังตรวจสอบพิกัด…"}
      </div>
      <div className="mb-4">
        <label className="text-sm text-neutral-600">เลือกชื่อพนักงาน</label>
        <div className="flex gap-2 mt-1">
          <select value={name} onChange={e=>setName(e.target.value)} className="flex-1 px-3 py-2 border rounded-xl">
            {employees.map(n=> <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={()=>{ const n=prompt("ชื่อพนักงานใหม่"); if(n && !employees.includes(n)){ setEmployees([...employees,n]); setBranchMap({...branchMap,[n]:Object.values(branchMap)[0]||"สาขากลาง"}); }}}
            className="px-3 py-2 rounded-xl bg-black text-white">+ เพิ่ม</button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden bg-neutral-900"><video ref={vidRef} autoPlay playsInline muted className="w-full aspect-video object-cover" /></div>
      {previewUrl && <div className="mt-3"><div className="text-sm text-neutral-600 mb-1">ภาพล่าสุด</div><img src={previewUrl} className="w-full rounded-xl shadow" /></div>}
      {err && <div className="mt-3 text-sm text-rose-600">{err}</div>}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <button disabled={loading} onClick={()=>addRecord("IN")} className="px-4 py-3 rounded-2xl bg-green-600 text-white font-semibold shadow disabled:opacity-50">Clock In</button>
        <button disabled={loading} onClick={()=>addRecord("OUT")} className="px-4 py-3 rounded-2xl bg-rose-600 text-white font-semibold shadow disabled:opacity-50">Clock Out</button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </Section>

    <Section title="บันทึกล่าสุด">
      <div className="overflow-auto max-h-[520px]">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-neutral-50"><tr>
            <th className="text-left p-2">เวลา</th><th className="text-left p-2">ชื่อ</th><th className="text-left p-2">สาขา</th><th className="text-left p-2">ประเภท</th><th className="text-left p-2">ระยะ</th><th className="text-left p-2">ในโซน</th><th className="text-left p-2">รูป</th>
          </tr></thead>
          <tbody>
            {records.length===0 && <tr><td colSpan={7} className="p-4 text-center text-neutral-500">ยังไม่มีข้อมูล</td></tr>}
            {records.map(r=> <tr key={r.id} className="border-t">
              <td className="p-2 whitespace-nowrap">{toLocal(r.ts)}</td>
              <td className="p-2">{r.name}</td>
              <td className="p-2">{r.branch||"—"}</td>
              <td className="p-2">{r.type}</td>
              <td className="p-2">{r.dist!=null? `${r.dist} ม.`:"—"}</td>
              <td className="p-2">{r.within? "✅":"⛔"}</td>
              <td className="p-2">{r.photo? <img src={r.photo} className="w-16 h-10 object-cover rounded" />: "—"}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </Section>
  </div>
}

function LeaveModule({ employees, name, setName, branchMap, leaveReqs, setLeaveReqs }){
  const [lvType, setLvType] = useState("ลาป่วย");
  const [lvStart, setLvStart] = useState(fmtDate(new Date()));
  const [lvEnd, setLvEnd] = useState(fmtDate(new Date()));
  const [lvDur, setLvDur] = useState("เต็มวัน");
  const [lvHours, setLvHours] = useState(0);
  const [lvReason, setLvReason] = useState("");

  function submitLeave(){
    const id=crypto.randomUUID();
    const req={ id, employee:name, branch: branchMap[name]||"", leaveType:lvType, startDate:lvStart, endDate:lvEnd, duration: lvDur+(lvDur==="ชั่วโมง"?` ${lvHours}h`:""), reason: lvReason, status:"Pending", approver:"", createdAt:new Date().toISOString() };
    setLeaveReqs([req, ...leaveReqs]); setLvReason(""); alert("ส่งคำขอลาแล้ว");
  }

  return <div className="grid md:grid-cols-2 gap-6">
    <Section title="ยื่นลางาน">
      <div className="mb-3"><label className="text-sm text-neutral-600">ชื่อพนักงาน</label>
        <div className="flex gap-2 mt-1">
          <select value={name} onChange={e=>setName(e.target.value)} className="flex-1 px-3 py-2 border rounded-xl">{employees.map(n=> <option key={n} value={n}>{n}</option>)}</select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-sm text-neutral-600">ประเภทลา</label><select value={lvType} onChange={e=>setLvType(e.target.value)} className="w-full px-3 py-2 border rounded-xl">{["ลาป่วย","ลากิจ","ลาพักร้อน","ลาคลอด","ลาโดยไม่รับค่าจ้าง"].map(t=> <option key={t}>{t}</option>)}</select></div>
        <div><label className="text-sm text-neutral-600">ช่วงเวลา</label><select value={lvDur} onChange={e=>setLvDur(e.target.value)} className="w-full px-3 py-2 border rounded-xl">{["เต็มวัน","ครึ่งวันเช้า","ครึ่งวันบ่าย","ชั่วโมง"].map(d=> <option key={d}>{d}</option>)}</select></div>
        {lvDur==="ชั่วโมง" && <div><label className="text-sm text-neutral-600">ชั่วโมงที่ลา</label><input type="number" min={1} max={8} value={lvHours} onChange={e=>setLvHours(parseInt(e.target.value||"0"))} className="w-full px-3 py-2 border rounded-xl" /></div>}
        <div><label className="text-sm text-neutral-600">ตั้งแต่</label><input type="date" value={lvStart} onChange={e=>setLvStart(e.target.value)} className="w-full px-3 py-2 border rounded-xl" /></div>
        <div><label className="text-sm text-neutral-600">ถึง</label><input type="date" value={lvEnd} onChange={e=>setLvEnd(e.target.value)} className="w-full px-3 py-2 border rounded-xl" /></div>
      </div>
      <div className="mt-3"><label className="text-sm text-neutral-600">เหตุผล</label><textarea rows={3} value={lvReason} onChange={e=>setLvReason(e.target.value)} className="w-full px-3 py-2 border rounded-xl" placeholder="อธิบายสั้นๆ" /></div>
      <div className="mt-4"><button onClick={submitLeave} className="px-4 py-3 rounded-2xl bg-neutral-900 text-white font-semibold shadow">ส่งคำขอ</button></div>
    </Section>

    <Section title="คำขอของฉัน">
      <div className="overflow-auto max-h-[520px]">
        <table className="min-w-full text-sm"><thead className="sticky top-0 bg-neutral-50"><tr><th className="text-left p-2">ยื่นเมื่อ</th><th className="text-left p-2">ประเภท</th><th className="text-left p-2">ช่วง</th><th className="text-left p-2">สถานะ</th></tr></thead>
          <tbody>{leaveReqs.filter(l=>l.employee===name).map(l=> (<tr key={l.id} className="border-t"><td className="p-2 whitespace-nowrap">{toLocal(l.createdAt)}</td><td className="p-2">{l.leaveType}</td><td className="p-2">{l.startDate} → {l.endDate} ({l.duration})</td><td className="p-2">{badge(l.status)}</td></tr>))}</tbody>
        </table>
      </div>
    </Section>
  </div>
}

function AdminModule({ org, setOrg, employees, setEmployees, branches, setBranches, branchMap, setBranchMap, shiftMap, setShiftMap, leaveReqs }){
  const [newEmp, setNewEmp] = useState("");
  const [newBranch, setNewBranch] = useState("");
  function exportLeaveCSV(){
    const header=["id","employee","type","from","to","duration","reason","status","approver","created_at"];
    const rows=[header, ...leaveReqs.map(r=>[r.id,r.employee,r.leaveType,r.startDate,r.endDate,r.duration,r.reason||"",r.status,r.approver||"",r.createdAt])];
    downloadCSV(rows, `leave_${fmtDate(new Date())}.csv`);
  }
  return <div className="grid gap-6">
    <Section title="ตั้งค่าองค์กร / จุดทำงาน">
      <div className="grid md:grid-cols-4 gap-3 mb-2">
        <div className="md:col-span-2"><label className="text-sm text-neutral-600">ชื่อร้าน/บริษัท</label><input value={org.orgName} onChange={e=>setOrg({...org, orgName:e.target.value})} className="w-full px-3 py-2 border rounded-xl" /></div>
        <div><label className="text-sm text-neutral-600">Lat</label><input type="number" step="0.000001" value={org.siteLat} onChange={e=>setOrg({...org, siteLat:parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-xl" /></div>
        <div><label className="text-sm text-neutral-600">Lng</label><input type="number" step="0.000001" value={org.siteLng} onChange={e=>setOrg({...org, siteLng:parseFloat(e.target.value)})} className="w-full px-3 py-2 border rounded-xl" /></div>
        <div><label className="text-sm text-neutral-600">รัศมี (เมตร)</label><input type="number" value={org.radiusM} onChange={e=>setOrg({...org, radiusM:parseInt(e.target.value||"0")})} className="w-full px-3 py-2 border rounded-xl" /></div>
      </div>
      <div className="text-xs text-neutral-500">* แก้จุดทำงานตามจริง เพื่อคำนวณในโซน/นอกโซน</div>
    </Section>

    <Section title="สาขา">
      <div className="flex gap-2 mb-3">
        <input placeholder="เพิ่มชื่อสาขา" value={newBranch} onChange={e=>setNewBranch(e.target.value)} className="flex-1 px-3 py-2 border rounded-xl" />
        <button onClick={()=>{ if(newBranch && !branches.includes(newBranch)){ setBranches([...branches,newBranch]); setNewBranch(""); }}} className="px-3 py-2 rounded-xl bg-black text-white">+ เพิ่มสาขา</button>
      </div>
      <div className="flex flex-wrap gap-2">{branches.map(b=> <span key={b} className="px-3 py-1 rounded-full bg-neutral-100 border text-sm">{b}</span>)}</div>
    </Section>

    <Section title="รายชื่อพนักงาน / กะงาน / สาขา">
      <div className="flex gap-2 mb-3">
        <input placeholder="เพิ่มชื่อพนักงาน" value={newEmp} onChange={e=>setNewEmp(e.target.value)} className="flex-1 px-3 py-2 border rounded-xl" />
        <button onClick={()=>{ if(newEmp && !employees.includes(newEmp)){ setEmployees([...employees,newEmp]); setBranchMap({...branchMap,[newEmp]:branches[0]}); setShiftMap({...shiftMap,[newEmp]:"A"}); setNewEmp(""); }}} className="px-3 py-2 rounded-xl bg-black text-white">+ เพิ่ม</button>
      </div>
      <div className="overflow-auto">
        <table className="min-w-full text-sm"><thead className="bg-neutral-50 sticky top-0"><tr><th className="text-left p-2">ชื่อ</th><th className="text-left p-2">กะงาน</th><th className="text-left p-2">สาขา</th></tr></thead>
          <tbody>{employees.map(emp=> (
            <tr key={emp} className="border-t">
              <td className="p-2">{emp}</td>
              <td className="p-2"><select value={shiftMap[emp]||"A"} onChange={e=>setShiftMap({...shiftMap,[emp]:e.target.value})} className="px-2 py-1 border rounded-lg">{defaultShifts.map(s=> <option key={s.code} value={s.code}>{s.code} — {s.label}</option>)}</select></td>
              <td className="p-2"><select value={branchMap[emp]||branches[0]} onChange={e=>setBranchMap({...branchMap,[emp]:e.target.value})} className="px-2 py-1 border rounded-lg">{branches.map(b=> <option key={b} value={b}>{b}</option>)}</select></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Section>

    <Section title="อนุมัติใบลา" right={<button onClick={exportLeaveCSV} className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm">Export CSV</button>}>
      <div className="overflow-auto max-h-[420px]">
        <table className="min-w-full text-sm"><thead className="bg-neutral-50 sticky top-0"><tr><th className="text-left p-2">ยื่นเมื่อ</th><th className="text-left p-2">พนักงาน</th><th className="text-left p-2">สาขา</th><th className="text-left p-2">ประเภท</th><th className="text-left p-2">ช่วง</th><th className="text-left p-2">สถานะ</th></tr></thead>
          <tbody>{leaveReqs.length===0 && <tr><td colSpan={6} className="p-4 text-center text-neutral-500">ยังไม่มีคำขอ</td></tr>}
            {leaveReqs.map(l=> (<tr key={l.id} className="border-t">
              <td className="p-2 whitespace-nowrap">{toLocal(l.createdAt)}</td>
              <td className="p-2">{l.employee}</td>
              <td className="p-2">{l.branch||"—"}</td>
              <td className="p-2">{l.leaveType}</td>
              <td className="p-2">{l.startDate} → {l.endDate} ({l.duration})</td>
              <td className="p-2">{badge(l.status)}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </Section>
  </div>
}

function CalcModule({ employees, branchMap, shiftMap, records, leaveReqs }){
  const [from, setFrom] = useState(fmtDate(new Date(new Date().setDate(new Date().getDate()-7))));
  const [to, setTo] = useState(fmtDate(new Date()));
  const [workdaysOnly, setWorkdaysOnly] = useState(true);

  const shiftMapDef = Object.fromEntries(defaultShifts.map(s=>[s.code, s]));

  const rows = useMemo(()=>{
    const F=new Date(from+"T00:00:00"), T=new Date(to+"T23:59:59");
    const byEmp={};
    records.filter(r=> new Date(r.ts)>=F && new Date(r.ts)<=T).forEach(r=>{
      const d=fmtDate(r.ts); const e=r.name;
      byEmp[e] = byEmp[e] || {}; byEmp[e][d] = byEmp[e][d] || { IN:[], OUT:[] };
      byEmp[e][d][r.type].push(r);
    });
    const out=[];
    for(const e of employees){
      const shift=shiftMapDef[shiftMap[e]]||defaultShifts[0];
      for(let dt=new Date(F); dt<=T; dt.setDate(dt.getDate()+1)){
        const iso=fmtDate(dt); const dow=dt.getDay(); if(workdaysOnly && (dow===0||dow===6)) continue;
        const day=(byEmp[e]||{})[iso]||{IN:[],OUT:[]};
        const firstIn=day.IN.sort((a,b)=>new Date(a.ts)-new Date(b.ts))[0];
        const lastOut=day.OUT.sort((a,b)=>new Date(a.ts)-new Date(b.ts)).slice(-1)[0];
        let worked=0, late=0, ot=0, status="";
        const sStart=parseHM(shift.start), sEnd=parseHM(shift.end);
        if(firstIn && lastOut){
          const inMin=new Date(firstIn.ts).getHours()*60+new Date(firstIn.ts).getMinutes();
          const outMin=new Date(lastOut.ts).getHours()*60+new Date(lastOut.ts).getMinutes();
          worked=Math.max(0,outMin-inMin); late=Math.max(0,inMin-sStart); ot=Math.max(0,outMin-sEnd); status="Present";
        }else if(!firstIn && !lastOut){
          const onLeave = leaveReqs.find(l=> l.employee===e && l.status!=="Rejected" && iso>=l.startDate && iso<=l.endDate);
          status = onLeave? `Leave:${onLeave.leaveType}` : "Absent";
        }else{ status="Partial"; }
        out.push({ date:iso, employee:e, branch:branchMap[e]||"", shift:shift.label, status, workedMin:worked, lateMin:late, otMin:ot });
      }
    }
    return out;
  },[records, leaveReqs, from, to, workdaysOnly, shiftMap, employees, branchMap]);

  const totalsByEmp = useMemo(()=>{
    const agg={}; for(const r of rows){ const a=agg[r.employee]||(agg[r.employee]={worked:0,late:0,ot:0,absent:0}); a.worked+=r.workedMin; a.late+=r.lateMin; a.ot+=r.otMin; if(r.status==="Absent") a.absent+=1; } return agg;
  },[rows]);

  function exportDaily(){ const header=["date","employee","branch","shift","status","worked_min","late_min","ot_min"]; downloadCSV([header, ...rows.map(r=>[r.date,r.employee,r.branch,r.shift,r.status,r.workedMin,r.lateMin,r.otMin])], `summary_${from}_to_${to}.csv`); }

  return <div className="grid gap-6">
    <Section title="คำนวณชั่วโมงทำงาน">
      <div className="grid md:grid-cols-4 gap-3 mb-3">
        <div><label className="text-sm text-neutral-600">ตั้งแต่</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-full px-3 py-2 border rounded-xl" /></div>
        <div><label className="text-sm text-neutral-600">ถึง</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-full px-3 py-2 border rounded-xl" /></div>
        <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={workdaysOnly} onChange={e=>setWorkdaysOnly(e.target.checked)} />ตัดเสาร์-อาทิตย์ออก</label>
        <div className="flex items-end"><button onClick={exportDaily} className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm">Export รายวัน</button></div>
      </div>
      <div className="overflow-auto max-h-[400px]">
        <table className="min-w-full text-sm"><thead className="bg-neutral-50 sticky top-0"><tr><th className="text-left p-2">วันที่</th><th className="text-left p-2">พนักงาน</th><th className="text-left p-2">สาขา</th><th className="text-left p-2">กะ</th><th className="text-left p-2">สถานะ</th><th className="text-left p-2">ชั่วโมงทำงาน</th><th className="text-left p-2">มาสาย</th><th className="text-left p-2">OT</th></tr></thead>
          <tbody>{rows.map((r,i)=> <tr key={i} className="border-t"><td className="p-2 whitespace-nowrap">{r.date}</td><td className="p-2">{r.employee}</td><td className="p-2">{r.branch||"—"}</td><td className="p-2">{r.shift}</td><td className="p-2">{r.status}</td><td className="p-2">{minutesToHM(r.workedMin)}</td><td className="p-2">{minutesToHM(r.lateMin)}</td><td className="p-2">{minutesToHM(r.otMin)}</td></tr>)}</tbody>
        </table>
      </div>
    </Section>

    <Section title="สรุปตามพนักงาน">
      <div className="grid md:grid-cols-3 gap-3">
        {Object.entries(totalsByEmp).map(([emp,t])=> (
          <div key={emp} className="p-4 rounded-2xl bg-white shadow">
            <div className="font-semibold mb-2">{emp}</div>
            <div className="text-sm">ชั่วโมงทำงานรวม: <b>{minutesToHM(t.worked)}</b></div>
            <div className="text-sm">มาสายรวม: <b>{minutesToHM(t.late)}</b></div>
            <div className="text-sm">OT รวม: <b>{minutesToHM(t.ot)}</b></div>
            <div className="text-sm">วันขาดงาน: <b>{t.absent}</b></div>
          </div>
        ))}
      </div>
    </Section>
  </div>
}

function DashboardModule({ employees, branchMap, shiftMap, records, leaveReqs }){
  const [from, setFrom] = useState(fmtDate(new Date(new Date().setDate(new Date().getDate()-7))));
  const [to, setTo] = useState(fmtDate(new Date()));
  const [emp, setEmp] = useState("ทั้งหมด");
  const [branch, setBranch] = useState("ทั้งหมด");

  // reuse calc logic for rows
  const calcRows = useMemo(()=>{
    const F=new Date(from+"T00:00:00"), T=new Date(to+"T23:59:59");
    const byEmp={};
    records.filter(r=> new Date(r.ts)>=F && new Date(r.ts)<=T).forEach(r=>{
      const d=fmtDate(r.ts); const e=r.name;
      byEmp[e] = byEmp[e] || {}; byEmp[e][d] = byEmp[e][d] || { IN:[], OUT:[] };
      byEmp[e][d][r.type].push(r);
    });
    const shiftDef = Object.fromEntries(defaultShifts.map(s=>[s.code,s]));
    const out=[];
    for(const e of employees){
      const shift=shiftDef[shiftMap[e]]||defaultShifts[0];
      for(let dt=new Date(F); dt<=T; dt.setDate(dt.getDate()+1)){
        const iso=fmtDate(dt);
        const day=(byEmp[e]||{})[iso]||{IN:[],OUT:[]};
        const firstIn=day.IN.sort((a,b)=>new Date(a.ts)-new Date(b.ts))[0];
        const lastOut=day.OUT.sort((a,b)=>new Date(a.ts)-new Date(b.ts)).slice(-1)[0];
        let worked=0, late=0, ot=0, status="";
        const sStart=parseHM(shift.start), sEnd=parseHM(shift.end);
        if(firstIn && lastOut){
          const inMin=new Date(firstIn.ts).getHours()*60+new Date(firstIn.ts).getMinutes();
          const outMin=new Date(lastOut.ts).getHours()*60+new Date(lastOut.ts).getMinutes();
          worked=Math.max(0,outMin-inMin); late=Math.max(0,inMin-sStart); ot=Math.max(0,outMin-sEnd); status="Present";
        }else{ status="Absent"; }
        out.push({ date:iso, employee:e, branch:branchMap[e]||"", status, lateMin:late, otMin:ot });
      }
    }
    return out;
  },[records, from, to, employees, branchMap, shiftMap]);

  const filtered = useMemo(()=> calcRows
    .filter(r=> emp==="ทั้งหมด" or r.employee===emp)
    .filter(r=> branch==="ทั้งหมด" or r.branch===branch)
  ,[calcRows, emp, branch]);

  const dailyAgg = useMemo(()=>{
    const map={};
    for(const r of filtered){
      const m = map[r.date] || (map[r.date]={ date:r.date, lateMin:0, otMin:0, absent:0 });
      m.lateMin += r.lateMin;
      m.otMin += r.otMin;
      if(r.status==="Absent") m.absent += 1;
      map[r.date]=m;
    }
    return Object.values(map).sort((a,b)=> a.date.localeCompare(b.date));
  },[filtered]);

  function exportDashboard(){ const header=["date","late_min_total","ot_min_total","absent_count"]; downloadCSV([header, ...dailyAgg.map(d=>[d.date,d.lateMin,d.otMin,d.absent])], `dashboard_${from}_to_${to}.csv`); }

  return <div className="grid gap-6">
    <Section title="แดชบอร์ด HR" right={<button onClick={exportDashboard} className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm">ดาวน์โหลดรายงาน</button>}>
      <div className="grid md:grid-cols-5 gap-3 mb-4">
        <div><label className="text-sm text-neutral-600">ตั้งแต่</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-full px-3 py-2 border rounded-xl" /></div>
        <div><label className="text-sm text-neutral-600">ถึง</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-full px-3 py-2 border rounded-xl" /></div>
        <div><label className="text-sm text-neutral-600">พนักงาน</label><select value={emp} onChange={e=>setEmp(e.target.value)} className="w-full px-3 py-2 border rounded-xl"><option>ทั้งหมด</option>{employees.map(e=> <option key={e}>{e}</option>)}</select></div>
        <div><label className="text-sm text-neutral-600">สาขา</label><select value={branch} onChange={e=>setBranch(e.target.value)} className="w-full px-3 py-2 border rounded-xl"><option>ทั้งหมด</option>{[...new Set(Object.values(branchMap))].map(b=> <option key={b}>{b}</option>)}</select></div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow p-3">
          <div className="font-semibold mb-2">มาสายรวม (นาที)</div>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyAgg}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="lateMin" name="มาสาย (นาที)" /></LineChart>
          </ResponsiveContainer></div>
        </div>
        <div className="bg-white rounded-2xl shadow p-3">
          <div className="font-semibold mb-2">OT รวม (นาที)</div>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyAgg}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Bar dataKey="otMin" name="OT (นาที)" /></BarChart>
          </ResponsiveContainer></div>
        </div>
        <div className="bg-white rounded-2xl shadow p-3">
          <div className="font-semibold mb-2">ขาดงาน (จำนวนคน)</div>
          <div className="h-64"><ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyAgg}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="absent" name="ขาดงาน (คน)" /></LineChart>
          </ResponsiveContainer></div>
        </div>
      </div>
      <div className="mt-4 text-xs text-neutral-500">* กรองข้อมูลด้วยตัวกรองด้านบน แล้วดาวน์โหลด CSV</div>
    </Section>

    <Section title="ตารางข้อมูลหลังกรอง">
      <div className="overflow-auto max-h-[400px]">
        <table className="min-w-full text-sm"><thead className="bg-neutral-50 sticky top-0"><tr><th className="text-left p-2">วันที่</th><th className="text-left p-2">พนักงาน</th><th className="text-left p-2">สาขา</th><th className="text-left p-2">สถานะ</th><th className="text-left p-2">มาสาย(นาที)</th><th className="text-left p-2">OT(นาที)</th></tr></thead>
          <tbody>{filtered.map((r,i)=> <tr key={i} className="border-t"><td className="p-2 whitespace-nowrap">{r.date}</td><td className="p-2">{r.employee}</td><td className="p-2">{r.branch||"—"}</td><td className="p-2">{r.status}</td><td className="p-2">{r.lateMin}</td><td className="p-2">{r.otMin}</td></tr>)}</tbody>
        </table>
      </div>
    </Section>
  </div>
}
