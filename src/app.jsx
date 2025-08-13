import React, { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; const toRad = (deg) => (deg * Math.PI) / 180;
  const φ1 = toRad(lat1), φ2 = toRad(lat2), Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return R * c;
}
const fmtDate = (d)=> new Date(d).toISOString().slice(0,10);
const toLocal = (d)=> new Date(d).toLocaleString("th-TH");
const parseTimeStr = (t)=>{const [H,M]=(t||"0:0").split(":").map(Number);return H*60+(M||0)};
const ls = { get(k,f){ try{ const r=localStorage.getItem(k); return r?JSON.parse(r):f }catch{return f}}, set(k,v){ localStorage.setItem(k, JSON.stringify(v)) }};
const ADMIN_NAME = "คุณแบงค์";

const defaultEmployees = ["คุณแบงค์","พนักงาน A","พนักงาน B"];
const seedOrg = { orgName: "Demo Store", siteLat: 13.7563, siteLng: 100.5018, radiusM: 200 };
const defaultShifts = [{code:"A",label:"10:00-19:00",start:"10:00",end:"19:00"},{code:"B",label:"11:00-20:00",start:"11:00",end:"20:00"}];
const defaultBranches = ["สาขากลาง","สาขา A"];

export default function App(){
  const [org,setOrg]=useState(ls.get("org",seedOrg));
  const [employees,setEmployees]=useState(ls.get("employees",defaultEmployees));
  const [name,setName]=useState(employees[0]||"");
  const [records,setRecords]=useState(ls.get("records",[]));
  const [leaveReqs,setLeaveReqs]=useState(ls.get("leaveReqs",[]));
  const [shiftMap,setShiftMap]=useState(ls.get("shiftMap",Object.fromEntries(employees.map(e=>[e,defaultShifts[0].code]))));
  const [branches,setBranches]=useState(ls.get("branches",defaultBranches));
  const [branchMap,setBranchMap]=useState(ls.get("branchMap",Object.fromEntries(employees.map(e=>[e,branches[0]]))));

  const [apiUrl,setApiUrl]=useState(ls.get("apiUrl","")); const [apiStatus,setApiStatus]=useState("");
  const qRef = useRef(ls.get("apiQueue",[])); const saveQ=()=>ls.set("apiQueue",qRef.current);
  async function flushQueue(){ if(!apiUrl) return; const remain=[]; for(const item of qRef.current){ try{ await fetch(apiUrl+item.path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(item.payload)});}catch{remain.push(item)} } qRef.current=remain; saveQ(); setApiStatus(remain.length?`Pending ${remain.length}`:"Synced"); }
  async function postToAPI(path,payload){ if(!apiUrl){ qRef.current.push({path,payload}); saveQ(); setApiStatus("Offline"); return; } try{ const res=await fetch(apiUrl+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); if(!res.ok) throw new Error(); setApiStatus("Synced"); }catch(e){ qRef.current.push({path,payload}); saveQ(); setApiStatus("Queued"); } }
  useEffect(()=>{ ls.set("apiUrl",apiUrl); flushQueue(); },[apiUrl]);

  const [tab,setTab]=useState("admin");
  const vidRef=useRef(null), canvasRef=useRef(null), streamRef=useRef(null);
  const [pos,setPos]=useState(null), [previewUrl,setPreviewUrl]=useState(""), [err,setErr]=useState(""), [loading,setLoading]=useState(false);

  useEffect(()=>{ (async()=>{ try{ const s=await navigator.mediaDevices.getUserMedia({video:true}); streamRef.current=s; if(vidRef.current) vidRef.current.srcObject=s; }catch{} })(); getPosition(); return ()=>{ streamRef.current?.getTracks().forEach(t=>t.stop()); }; },[]);
  function getPosition(){ navigator.geolocation.getCurrentPosition(p=>setPos({lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy}),()=>{}, {enableHighAccuracy:true,timeout:12000,maximumAge:10000}); }
  const within = useMemo(()=>{ if(!pos) return null; const d=haversineDistance(pos.lat,pos.lng,org.siteLat,org.siteLng); return {d, ok:d<=Number(org.radiusM||0)} },[pos,org]);
  function snap(){ const v=vidRef.current,c=canvasRef.current; if(!v||!c) return; const w=v.videoWidth||640,h=v.videoHeight||480; c.width=w;c.height=h; const ctx=c.getContext("2d"); ctx.drawImage(v,0,0,w,h); const url=c.toDataURL("image/jpeg",0.9); setPreviewUrl(url); return url; }
  async function addRecord(type){ setLoading(true); try{ const photo=snap(); const ts=new Date().toISOString(); const rec={ id:crypto.randomUUID(), name, branch:branchMap[name]||"", type, ts, lat:pos?.lat??null, lng:pos?.lng??null, acc:pos?.acc??null, dist:within?Math.round(within.d):null, within:within?.ok??false, photo }; setRecords(r=>[rec,...r]); postToAPI("/time",rec);} finally{ setLoading(false);}}

  const isAdmin = name===ADMIN_NAME;
  async function saveSettings(){ const payload={ org, employees, shiftMap, branches, branchMap, updatedAt:new Date().toISOString() }; ["org","employees","shiftMap","branches","branchMap"].forEach(k=>ls.set(k,eval(k))); await postToAPI("/settings",payload); alert("บันทึกแล้ว"); }

  const [newEmp,setNewEmp]=useState(""); const [newBranch,setNewBranch]=useState("");
  return (<div className="p-4 max-w-5xl mx-auto">
    <header className="flex justify-between mb-4"><h1 className="text-2xl font-bold">HR Mini App</h1>
      <select value={name} onChange={e=>setName(e.target.value)} className="px-3 py-2 border rounded-xl">{employees.map(e=><option key={e}>{e}</option>)}</select>
    </header>

    <section className="bg-white p-4 rounded-2xl shadow mb-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold">เชื่อมต่อ Google Sheets</h2>
        <span className={"text-xs px-2 py-1 rounded-full "+(isAdmin?"bg-green-100 text-green-800":"bg-neutral-100 text-neutral-600")}>{isAdmin?"Admin":"Read-only"}</span>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <input value={apiUrl} onChange={e=>setApiUrl(e.target.value)} placeholder="https://script.google.com/.../exec" className="md:col-span-2 px-3 py-2 border rounded-xl" disabled={!isAdmin} />
        <button onClick={flushQueue} className="px-3 py-2 rounded-xl bg-neutral-900 text-white" disabled={!isAdmin}>Sync คิว</button>
      </div>
      <div className="text-xs text-neutral-500 mt-1">{apiStatus}</div>
    </section>

    <section className="bg-white p-4 rounded-2xl shadow mb-4">
      <h2 className="font-semibold mb-2">ตั้งค่าองค์กร / จุดทำงาน</h2>
      <div className="grid md:grid-cols-5 gap-3">
        <input value={org.orgName} onChange={e=>setOrg({...org, orgName:e.target.value})} className="md:col-span-2 px-3 py-2 border rounded-xl" disabled={!isAdmin}/>
        <input type="number" step="0.000001" value={org.siteLat} onChange={e=>setOrg({...org, siteLat:parseFloat(e.target.value)})} className="px-3 py-2 border rounded-xl" disabled={!isAdmin}/>
        <input type="number" step="0.000001" value={org.siteLng} onChange={e=>setOrg({...org, siteLng:parseFloat(e.target.value)})} className="px-3 py-2 border rounded-xl" disabled={!isAdmin}/>
        <input type="number" value={org.radiusM} onChange={e=>setOrg({...org, radiusM:parseInt(e.target.value||"0")})} className="px-3 py-2 border rounded-xl" disabled={!isAdmin}/>
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={()=>navigator.geolocation.getCurrentPosition(p=>setOrg({...org, siteLat:p.coords.latitude, siteLng:p.coords.longitude}))} disabled={!isAdmin} className="px-3 py-2 rounded-xl bg-neutral-900 text-white">ตั้งตำแหน่ง = พิกัดปัจจุบัน</button>
      </div>
    </section>

    <section className="bg-white p-4 rounded-2xl shadow mb-4">
      <h2 className="font-semibold mb-2">สาขา</h2>
      <div className="flex gap-2 mb-2">
        <input value={newBranch} onChange={e=>setNewBranch(e.target.value)} placeholder="เพิ่มชื่อสาขา" className="flex-1 px-3 py-2 border rounded-xl" disabled={!isAdmin}/>
        <button onClick={()=>{ if(!newBranch||!isAdmin) return; if(!branches.includes(newBranch)) setBranches([...branches,newBranch]); setNewBranch(""); }} className="px-3 py-2 rounded-xl bg-black text-white" disabled={!isAdmin}>+ เพิ่มสาขา</button>
      </div>
      <div className="flex flex-wrap gap-2">{branches.map(b=> <span key={b} className="px-3 py-1 rounded-full bg-neutral-100 border text-sm">{b}</span>)}</div>
    </section>

    <section className="bg-white p-4 rounded-2xl shadow mb-4">
      <h2 className="font-semibold mb-2">รายชื่อพนักงาน / กะงาน / สาขา</h2>
      <div className="flex gap-2 mb-3">
        <input value={newEmp} onChange={e=>setNewEmp(e.target.value)} placeholder="เพิ่มชื่อพนักงาน" className="flex-1 px-3 py-2 border rounded-xl" disabled={!isAdmin}/>
        <button onClick={()=>{ if(!newEmp||!isAdmin) return; if(!employees.includes(newEmp)) { setEmployees([...employees,newEmp]); setShiftMap({...shiftMap,[newEmp]:"A"}); setBranchMap({...branchMap,[newEmp]:branches[0]}); setNewEmp(""); } }} className="px-3 py-2 rounded-xl bg-black text-white" disabled={!isAdmin}>+ เพิ่ม</button>
      </div>
      <div className="overflow-auto"><table className="min-w-full text-sm">
        <thead className="bg-neutral-50"><tr><th className="text-left p-2">ชื่อ</th><th className="text-left p-2">กะงาน</th><th className="text-left p-2">สาขา</th></tr></thead>
        <tbody>{employees.map(emp=> (<tr key={emp} className="border-t">
          <td className="p-2">{emp}</td>
          <td className="p-2"><select value={shiftMap[emp]||"A"} onChange={e=>setShiftMap({...shiftMap,[emp]:e.target.value})} className="px-2 py-1 border rounded-lg" disabled={!isAdmin}>
            {defaultShifts.map(s=> <option key={s.code} value={s.code}>{s.code} — {s.label}</option>)}
          </select></td>
          <td className="p-2"><select value={branchMap[emp]||branches[0]} onChange={e=>setBranchMap({...branchMap,[emp]:e.target.value})} className="px-2 py-1 border rounded-lg" disabled={!isAdmin}>
            {branches.map(b=> <option key={b} value={b}>{b}</option>)}
          </select></td>
        </tr>))}</tbody></table></div>
    </section>

    <div className="text-right">{isAdmin ? <button onClick={saveSettings} className="px-4 py-3 rounded-2xl bg-neutral-900 text-white font-semibold shadow">บันทึกการตั้งค่า</button> : <span className="text-xs text-neutral-500">* อ่านอย่างเดียว (เฉพาะ Admin แก้ไขได้)</span>}</div>

    <hr className="my-6" />

    <section className="bg-white p-4 rounded-2xl shadow">
      <h2 className="font-semibold mb-3">ลงเวลา (Selfie + พิกัด)</h2>
      <video ref={vidRef} autoPlay playsInline className="w-full rounded-xl bg-black/10" />
      <canvas ref={canvasRef} className="hidden" />
      <div className="mt-3 flex gap-2">
        <button disabled={loading} onClick={()=>addRecord("IN")} className="px-3 py-2 rounded-xl bg-green-600 text-white">Clock In</button>
        <button disabled={loading} onClick={()=>addRecord("OUT")} className="px-3 py-2 rounded-xl bg-rose-600 text-white">Clock Out</button>
      </div>
    </section>
  </div>);
}
