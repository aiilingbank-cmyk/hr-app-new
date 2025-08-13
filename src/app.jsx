import React, { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

/** ================= Utilities ================= */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; const toRad = (deg) => (deg * Math.PI) / 180;
  const φ1 = toRad(lat1), φ2 = toRad(lat2), Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return R * c;
}
function fmtDate(d){ try { return new Date(d).toISOString().slice(0,10); } catch { return ""; } }
function toLocal(dt){ try { return new Date(dt).toLocaleString("th-TH"); } catch { return dt; } }
function parseTimeStr(t){ const [H,M] = (t||"0:0").split(":").map(Number); return H*60 + (M||0); }
function minutesToHM(m){ const sign=m<0?"-":""; const x=Math.abs(Math.round(m)); const h=Math.floor(x/60); const mm=x%60; return `${sign}${h}h ${mm}m`; }
function downloadCSV(matrix, filename){
  const csv = matrix.map(row => row.map(v => v==null?"":String(v).replaceAll('"','""')).map(v=>`"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
const ls = { get(k,f){ try{ const r=localStorage.getItem(k); return r?JSON.parse(r):f; }catch{ return f; } }, set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} } };
const badge = (s)=> <span className={"px-2 py-1 rounded-full text-xs "+(s==="Approved"?"bg-emerald-100 text-emerald-700":s==="Rejected"?"bg-rose-100 text-rose-700":"bg-amber-100 text-amber-700")}>{s}</span>;

/** ================ Seeds ================ */
const defaultEmployees = ["คุณแบงค์", "พนักงาน A", "พนักงาน B", "พนักงาน C"];
const seedOrg = { orgName: "Demo Store", siteLat: 13.7563, siteLng: 100.5018, radiusM: 200 };
const defaultShifts = [
  { code: "A", label: "10:00-19:00", start: "10:00", end: "19:00" },
  { code: "B", label: "10:30-19:30", start: "10:30", end: "19:30" },
  { code: "C", label: "11:00-20:00", start: "11:00", end: "20:00" },
  { code: "D", label: "11:30-20:30", start: "11:30", end: "20:30" },
  { code: "E", label: "12:00-21:00", start: "12:00", end: "21:00" },
];
const defaultBranches = ["สาขากลาง", "สาขา A", "สาขา B"];
const ADMIN_NAME = "คุณแบงค์";

/** ================ App ================ */
export default function HRMiniApp(){
  // core data
  const [org, setOrg] = useState(ls.get("org", seedOrg));
  const [employees, setEmployees] = useState(ls.get("employees", defaultEmployees));
  const [name, setName] = useState(employees[0] || "");
  const [records, setRecords] = useState(ls.get("records", []));
  const [leaveReqs, setLeaveReqs] = useState(ls.get("leaveReqs", []));
  const [shiftMap, setShiftMap] = useState(ls.get("shiftMap", Object.fromEntries(employees.map(e=>[e, defaultShifts[0].code]))));
  const [branches, setBranches] = useState(ls.get("branches", defaultBranches));
  const [branchMap, setBranchMap] = useState(ls.get("branchMap", Object.fromEntries(employees.map(e=>[e, branches[0]]))));

  // admin/auth additions
  const [users, setUsers] = useState(ls.get("users", {})); // { emp: { username, password } }
  const [statusMap, setStatusMap] = useState(ls.get("statusMap", Object.fromEntries(employees.map(e=>[e,"ปกติ"])))); // emp -> ปกติ/พ้นสภาพ
  const [currentUser, setCurrentUser] = useState(ls.get("currentUser", null)); // { name, username }

  // Google Sheets connector
  const [apiUrl, setApiUrl] = useState(ls.get("apiUrl",""));
  const [apiStatus, setApiStatus] = useState("");
  const queueRef = useRef(ls.get("apiQueue",[])); const saveQueue=()=>ls.set("apiQueue", queueRef.current);
  async function flushQueue(){ if(!apiUrl) return; const remain=[]; for(const item of queueRef.current){ try{ await fetch(apiUrl+item.path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(item.payload)});}catch{remain.push(item)} } queueRef.current=remain; saveQueue(); setApiStatus(remain.length?`Pending ${remain.length}`:"Synced"); }
  async function postToAPI(path,payload){ if(!apiUrl){ queueRef.current.push({path,payload}); saveQueue(); setApiStatus("Offline"); return; } try{ const r=await fetch(apiUrl+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); if(!r.ok) throw new Error(); setApiStatus("Synced"); }catch(e){ queueRef.current.push({path,payload}); saveQueue(); setApiStatus("Queued"); } }
  useEffect(()=>{ ls.set("apiUrl", apiUrl); flushQueue(); }, [apiUrl]);

  // persist
  useEffect(()=>{ ls.set("org", org); }, [org]);
  useEffect(()=>{ ls.set("employees", employees); }, [employees]);
  useEffect(()=>{ ls.set("records", records); }, [records]);
  useEffect(()=>{ ls.set("leaveReqs", leaveReqs); }, [leaveReqs]);
  useEffect(()=>{ ls.set("shiftMap", shiftMap); }, [shiftMap]);
  useEffect(()=>{ ls.set("branches", branches); }, [branches]);
  useEffect(()=>{ ls.set("branchMap", branchMap); }, [branchMap]);
  useEffect(()=>{ ls.set("users", users); }, [users]);
  useEffect(()=>{ ls.set("statusMap", statusMap); }, [statusMap]);
  useEffect(()=>{ ls.set("currentUser", currentUser); }, [currentUser]);

  // UI state
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // camera + geo
  const vidRef=useRef(null), canvasRef=useRef(null), streamRef=useRef(null);
  const [pos, setPos] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  useEffect(()=>{ (async()=>{ try{ const stream = await navigator.mediaDevices.getUserMedia({ video: true }); streamRef.current=stream; if(vidRef.current) vidRef.current.srcObject=stream; }catch{} })(); getPosition(); return ()=>{ streamRef.current?.getTracks().forEach(t=>t.stop()); }; },[]);
  function getPosition(){ if(!("geolocation" in navigator)){ setErr("อุปกรณ์นี้ไม่รองรับพิกัด"); return; }
    navigator.geolocation.getCurrentPosition((p)=> setPos({ lat:p.coords.latitude, lng:p.coords.longitude, acc:p.coords.accuracy }), (e)=> setErr("ดึงพิกัดไม่ได้: "+e.message), { enableHighAccuracy:true, timeout:12000, maximumAge:10000 }); }
  const withinRadius = useMemo(()=>{ if(!pos) return null; const d=haversineDistance(pos.lat,pos.lng,org.siteLat,org.siteLng); return { d, ok:d<=Number(org.radiusM||0) }; }, [pos,org]);
  function takePhoto(){ const v=vidRef.current, c=canvasRef.current; if(!v||!c) return; const w=v.videoWidth||640, h=v.videoHeight||480; c.width=w; c.height=h; const ctx=c.getContext("2d"); ctx.drawImage(v,0,0,w,h); const url=c.toDataURL("image/jpeg",0.9); setPreviewUrl(url); return url; }
  async function addRecord(type){ setErr(""); setLoading(true); try { const photo=takePhoto(); const ts=new Date().toISOString(); const dist=withinRadius?Math.round(withinRadius.d):null; const ok=withinRadius?withinRadius.ok:false; const rec={ id:crypto.randomUUID(), name: currentUser?.name || name, branch: branchMap[currentUser?.name || name]||"", type, ts, lat:pos?.lat??null, lng:pos?.lng??null, acc:pos?.acc??null, dist, within:ok, photo }; setRecords(cur=>[rec, ...cur]); postToAPI('/time', rec); } finally { setLoading(false); } }

  // calculator + summary
  const [calcFrom, setCalcFrom] = useState(fmtDate(new Date(new Date().setDate(new Date().getDate()-7))));
  const [calcTo, setCalcTo] = useState(fmtDate(new Date()));
  const [workdaysOnly, setWorkdaysOnly] = useState(true);
  const shiftByCode = Object.fromEntries(defaultShifts.map(s=>[s.code, s]));
  function summarize(){
    const from=new Date(calcFrom+"T00:00:00"), to=new Date(calcTo+"T23:59:59");
    const byEmp={}; for(const emp of employees) byEmp[emp]={};
    const recs=records.filter(r=> new Date(r.ts)>=from && new Date(r.ts)<=to);
    for(const r of recs){ const d=fmtDate(r.ts); const bucket=byEmp[r.name]||(byEmp[r.name]={}); const day=bucket[d]||(bucket[d]={IN:[],OUT:[]}); day[r.type].push(r); }
    const rows=[];
    for(const emp of employees){ const shift=shiftByCode[shiftMap[emp]]||defaultShifts[0]; const empBranch=branchMap[emp]||"";
      for(let dt=new Date(from); dt<=to; dt.setDate(dt.getDate()+1)){
        const iso=fmtDate(dt); const dow=dt.getDay(); if(workdaysOnly && (dow===0||dow===6)) continue; const day=(byEmp[emp]||{})[iso]||{IN:[],OUT:[]};
        const firstIn=day.IN.sort((a,b)=>new Date(a.ts)-new Date(b.ts))[0]; const lastOut=day.OUT.sort((a,b)=>new Date(a.ts)-new Date(b.ts)).slice(-1)[0];
        const sStart=parseTimeStr(shift.start), sEnd=parseTimeStr(shift.end);
        let workedMin=0, lateMin=0, otMin=0, status="";
        if(firstIn && lastOut){ const inMin=new Date(firstIn.ts).getHours()*60+new Date(firstIn.ts).getMinutes(); const outMin=new Date(lastOut.ts).getHours()*60+new Date(lastOut.ts).getMinutes(); workedMin=Math.max(0,outMin-inMin); lateMin=Math.max(0,inMin-sStart); otMin=Math.max(0,outMin-sEnd); status="Present"; }
        else if(!firstIn && !lastOut){ const onLeave=leaveReqs.find(l=> l.employee===emp && l.status!=="Rejected" && iso>=l.startDate && iso<=l.endDate); status= onLeave?`Leave:${onLeave.leaveType}`:"Absent"; }
        else { status="Partial"; }
        rows.push({ date: iso, employee: emp, branch: empBranch, shift: shift.label, status, workedMin, lateMin, otMin });
      }
    }
    return rows;
  }
  const summaryRows = useMemo(()=> summarize(), [records, leaveReqs, calcFrom, calcTo, workdaysOnly, shiftMap, employees, branchMap]);
  const totalsByEmp = useMemo(()=>{ const agg={}; for(const r of summaryRows){ const k=r.employee; const a=agg[k]||(agg[k]={ worked:0, late:0, ot:0, absent:0 }); a.worked+=r.workedMin; a.late+=r.lateMin; a.ot+=r.otMin; if(r.status==="Absent") a.absent+=1; } return agg; }, [summaryRows]);

  // dashboard state + datasets
  const [dbFrom, setDbFrom] = useState(calcFrom);
  const [dbTo, setDbTo] = useState(calcTo);
  const [dbEmp, setDbEmp] = useState("ทั้งหมด");
  const [dbBranch, setDbBranch] = useState("ทั้งหมด");

  const dashboardRows = useMemo(()=>{
    const f=new Date(dbFrom+"T00:00:00"), t=new Date(dbTo+"T23:59:59");
    return summaryRows.filter(r=> new Date(r.date)>=f && new Date(r.date)<=t)
      .filter(r=> dbEmp==="ทั้งหมด"? true : r.employee===dbEmp)
      .filter(r=> dbBranch==="ทั้งหมด"? true : r.branch===dbBranch);
  }, [summaryRows, dbFrom, dbTo, dbEmp, dbBranch]);

  const dailyAgg = useMemo(()=>{
    const map={};
    for(const r of dashboardRows){
      const key=r.date; const m=map[key]||(map[key]={ date:key, lateMin:0, otMin:0, absent:0 });
      m.lateMin += r.lateMin||0;
      m.otMin += r.otMin||0;
      if(r.status==="Absent") m.absent += 1;
    }
    return Object.values(map).sort((a,b)=> a.date.localeCompare(b.date));
  }, [dashboardRows]);

  function exportCalcCSV(){ const header=["date","employee","branch","shift","status","worked_min","late_min","ot_min"]; const rows=summaryRows.map(r=>[r.date,r.employee,r.branch,r.shift,r.status,r.workedMin,r.lateMin,r.otMin]); downloadCSV([header,...rows], `summary_${calcFrom}_to_${calcTo}.csv`); }
  function exportDashboardCSV(){ const header=["date","late_min_total","ot_min_total","absent_count"]; const rows=dailyAgg.map(d=>[d.date,d.lateMin,d.otMin,d.absent]); downloadCSV([header,...rows], `dashboard_${dbFrom}_to_${dbTo}.csv`); }

  // ui helpers
  function addEmployee(){ const n=prompt("ชื่อพนักงานใหม่"); if(!n) return; if(!employees.includes(n)){ const next=[...employees,n]; setEmployees(next); setName(n); setShiftMap({...shiftMap,[n]:defaultShifts[0].code}); setBranchMap({...branchMap,[n]: branches[0]}); setStatusMap({...statusMap,[n]:"ปกติ"}); setUsers({...users,[n]:{username:"",password:""}}); } }
  function saveSettings(){ const payload={ org, employees, branches, shiftMap, branchMap, statusMap, users, updatedAt:new Date().toISOString() }; ["org","employees","branches","shiftMap","branchMap","statusMap","users"].forEach(k=>ls.set(k, eval(k))); postToAPI("/settings", payload); alert("บันทึกแล้ว"); }
  const isAdmin = (currentUser?.name||name) === ADMIN_NAME;

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">🧭 HR Mini App — ลงเวลา + ยื่นลางาน + คิดชั่วโมง + Dashboard + Login</h1>
          <div className="flex flex-wrap gap-2">
            <TabButton label="ลงเวลา" active={tab==="clock"} onClick={()=>setTab("clock")} />
            <TabButton label="ยื่นลางาน" active={tab==="leave"} onClick={()=>setTab("leave")} />
            <TabButton label="สำหรับ HR" active={tab==="admin"} onClick={()=>setTab("admin")} />
            <TabButton label="คำนวณชั่วโมง" active={tab==="calc"} onClick={()=>setTab("calc")} />
            <TabButton label="แดชบอร์ด" active={tab==="dashboard"} onClick={()=>setTab("dashboard")} />
            <TabButton label="เข้าสู่ระบบ" active={tab==="login"} onClick={()=>setTab("login")} />
          </div>
        </header>

        {tab === "clock" && (
          <ClockModule {...{ org, setOrg, employees, setEmployees, name, setName, addEmployee, pos, getPosition, withinRadius, vidRef, canvasRef, previewUrl, err, loading, addRecord, records, exportCSV, currentUser, statusMap }} />
        )}

        {tab === "leave" && (
          <LeaveModule {...{ employees, name, setName, addEmployee, leaveReqs, setLeaveReqs }} />
        )}

        {tab === "admin" && (
          <AdminModule {...{ org, setOrg, pos, getPosition, employees, setEmployees, shiftMap, setShiftMap, branches, setBranches, branchMap, setBranchMap, leaveReqs, setLeaveReqs, exportLeaveCSV:()=>{}, apiUrl, setApiUrl, apiStatus, flushQueue, users, setUsers, statusMap, setStatusMap, isAdmin, saveSettings }} />
        )}

        {tab === "calc" && (
          <CalcModule {...{ calcFrom, setCalcFrom, calcTo, setCalcTo, workdaysOnly, setWorkdaysOnly, summaryRows, totalsByEmp, exportCalcCSV }} />
        )}

        {tab === "dashboard" && (
          <DashboardModule {...{ employees, branches, dashboardRows, dailyAgg, dbFrom, setDbFrom, dbTo, setDbTo, dbEmp, setDbEmp, dbBranch, setDbBranch, exportDashboardCSV, leaveReqs }} />
        )}

        {tab === "login" && (
          <LoginModule {...{ users, statusMap, setCurrentUser, setName }} />
        )}

        <footer className="mt-8 text-center text-xs text-neutral-500">MVP เดโม่ — ข้อมูลอยู่ในอุปกรณ์นี้ (localStorage) • ต่อ Google Sheets/Backend ได้</footer>
      </div>
    </div>
  );
}

/** ================= Modules ================= */
function Section({ title, right, children }){
  return (
    <section className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">{title}</div>
        {right || null}
      </div>
      {children}
    </section>
  );
}
function TabButton({ label, active, onClick }){
  return <button onClick={onClick} className={"px-3 py-2 rounded-xl text-sm "+(active?"bg-black text-white":"bg-neutral-200")}>{label}</button>;
}

function ClockModule({ org, setOrg, employees, setEmployees, name, setName, addEmployee, pos, getPosition, withinRadius, vidRef, canvasRef, previewUrl, err, loading, addRecord, records, exportCSV, currentUser, statusMap }){
  const activeEmployees = employees.filter(e => (statusMap[e]||"ปกติ")==="ปกติ");
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Section title="ลงเวลา (Selfie + พิกัด)">
        <div className="mb-3"><label className="text-sm text-neutral-600">ชื่อพนักงาน</label>
          {currentUser ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="px-3 py-2 rounded-xl border bg-neutral-50">{currentUser.name}</span>
              <button onClick={()=>{ localStorage.removeItem("currentUser"); location.reload(); }} className="text-sm px-3 py-2 rounded-xl bg-neutral-200">ออกจากระบบ</button>
            </div>
          ) : (
            <div className="flex gap-2 mt-1">
              <select value={name} onChange={(e)=>setName(e.target.value)} className="flex-1 px-3 py-2 border rounded-xl">
                {activeEmployees.map((n)=> <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}
        </div>

        <video ref={vidRef} autoPlay playsInline className="w-full rounded-xl bg-black/10" />
        <canvas ref={canvasRef} className="hidden" />

        <div className="mt-3 flex gap-2">
          <button disabled={loading} onClick={()=>addRecord("IN")} className="px-3 py-2 rounded-xl bg-green-600 text-white">Clock In</button>
          <button disabled={loading} onClick={()=>addRecord("OUT")} className="px-3 py-2 rounded-xl bg-rose-600 text-white">Clock Out</button>
        </div>
        <div className="text-xs text-neutral-500 mt-2">{withinRadius? (withinRadius.ok? "✅ อยู่ในพื้นที่" : `⚠️ ห่างจุดทำงาน ~${Math.round(withinRadius.d)} m`) : "—"}</div>
        {err && <div className="text-rose-600 text-sm mt-1">{err}</div>}
      </Section>

      <Section title="ประวัติการลงเวลา" right={<button onClick={exportCSV} className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm">Export CSV</button>}>
        <div className="overflow-auto max-h-[520px]">
          <table className="min-w-full text-sm"><thead className="sticky top-0 bg-neutral-50"><tr><th className="text-left p-2">เวลา</th><th className="text-left p-2">ชื่อ</th><th className="text-left p-2">สาขา</th><th className="text-left p-2">ประเภท</th><th className="text-left p-2">พิกัด</th></tr></thead>
            <tbody>{records.map(r=> (<tr key={r.id} className="border-t"><td className="p-2 whitespace-nowrap">{toLocal(r.ts)}</td><td className="p-2">{r.name}</td><td className="p-2">{r.branch||"—"}</td><td className="p-2">{r.type}</td><td className="p-2">{r.lat?.toFixed?.(5)},{r.lng?.toFixed?.(5)}</td></tr>))}</tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function LeaveModule({ employees, name, setName, addEmployee, leaveReqs, setLeaveReqs }){
  const [lvType, setLvType] = useState("ลาป่วย");
  const [lvStart, setLvStart] = useState(fmtDate(new Date()));
  const [lvEnd, setLvEnd] = useState(fmtDate(new Date()));
  const [lvDur, setLvDur] = useState("เต็มวัน");
  const [lvHours, setLvHours] = useState(0);
  const [lvReason, setLvReason] = useState("");
  const types=["ลาป่วย","ลากิจ","ลาพักร้อน","ลาคลอด","ลาโดยไม่รับค่าจ้าง"]; const durs=["เต็มวัน","ครึ่งวันเช้า","ครึ่งวันบ่าย","ชั่วโมง"];
  function submitLeave(){ const id=crypto.randomUUID(); const req={ id, employee:name, leaveType:lvType, startDate:lvStart, endDate:lvEnd, duration: lvDur+(lvDur==="ชั่วโมง"?` ${lvHours}h`:""), reason: lvReason, status:"Pending", approver:"", remarks:"", createdAt:new Date().toISOString() }; setLeaveReqs([req, ...leaveReqs]); ls.set("leaveReqs", [req,...leaveReqs]); alert("ส่งคำขอลาแล้ว"); setLvReason(""); }
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Section title="ยื่นลางาน">
        <div className="mb-3"><label className="text-sm text-neutral-600">ชื่อพนักงาน</label>
          <div className="flex gap-2 mt-1"><select value={name} onChange={(e)=>setName(e.target.value)} className="flex-1 px-3 py-2 border rounded-xl">{employees.map((n)=> <option key={n} value={n}>{n}</option>)}</select><button onClick={addEmployee} className="px-3 py-2 rounded-xl bg-black text-white">+ เพิ่ม</button></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-sm text-neutral-600">ประเภทลา</label><select value={lvType} onChange={e=>setLvType(e.target.value)} className="w-full px-3 py-2 border rounded-xl">{types.map(t=> <option key={t}>{t}</option>)}</select></div>
          <div><label className="text-sm text-neutral-600">ช่วงเวลา</label><select value={lvDur} onChange={e=>setLvDur(e.target.value)} className="w-full px-3 py-2 border rounded-xl">{durs.map(d=> <option key={d}>{d}</option>)}</select></div>
          {lvDur==="ชั่วโมง" && (<div><label className="text-sm text-neutral-600">ชั่วโมงที่ลา</label><input type="number" min={1} max={8} value={lvHours} onChange={e=>setLvHours(parseInt(e.target.value||"0"))} className="w-full px-3 py-2 border rounded-xl" /></div>)}
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
  );
}

function AdminModule({ org, setOrg, pos, getPosition, employees, setEmployees, shiftMap, setShiftMap, branches, setBranches, branchMap, setBranchMap, leaveReqs, setLeaveReqs, exportLeaveCSV, apiUrl, setApiUrl, apiStatus, flushQueue, users, setUsers, statusMap, setStatusMap, isAdmin, saveSettings }){
  const [newEmp, setNewEmp] = useState("");
  const [newBranch, setNewBranch] = useState("");

  return (
    <div className="grid gap-6">
      <Section title="เชื่อมต่อ Google Sheets" right={<span className="text-xs text-neutral-500">{apiStatus||""}</span>}>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-sm text-neutral-600">Web App URL (Apps Script Deploy)</label>
            <input placeholder="https://script.google.com/.../exec" value={apiUrl} onChange={e=>setApiUrl(e.target.value)} className="w-full px-3 py-2 border rounded-xl" disabled={!isAdmin} />
          </div>
          <div className="flex items-end">
            <button onClick={flushQueue} className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm" disabled={!isAdmin}>Sync คิวที่ค้าง</button>
          </div>
        </div>
      </Section>

      <Section title="ตั้งค่าองค์กร / จุดทำงาน">
        <div className="grid md:grid-cols-4 gap-3 mb-2">
          <div className="md:col-span-2"><label className="text-sm text-neutral-600">ชื่อร้าน/บริษัท</label><input value={org.orgName} onChange={(e)=>setOrg({...org, orgName: e.target.value})} className="w-full px-3 py-2 border rounded-xl" disabled={!isAdmin} /></div>
          <div><label className="text-sm text-neutral-600">Lat</label><input value={org.siteLat} onChange={(e)=>setOrg({...org, siteLat: parseFloat(e.target.value)})} type="number" step="0.000001" className="w-full px-3 py-2 border rounded-xl" disabled={!isAdmin} /></div>
          <div><label className="text-sm text-neutral-600">Lng</label><input value={org.siteLng} onChange={(e)=>setOrg({...org, siteLng: parseFloat(e.target.value)})} type="number" step="0.000001" className="w-full px-3 py-2 border rounded-xl" disabled={!isAdmin} /></div>
          <div><label className="text-sm text-neutral-600">รัศมี (เมตร)</label><input value={org.radiusM} onChange={(e)=>setOrg({...org, radiusM: parseInt(e.target.value||"0")})} type="number" className="w-full px-3 py-2 border rounded-xl" disabled={!isAdmin} /></div>
          <div className="md:col-span-3 flex items-end gap-2"><button onClick={()=>{ if (!pos) return; setOrg({...org, siteLat: pos.lat, siteLng: pos.lng}); }} className="px-3 py-2 rounded-xl bg-neutral-900 text-white" disabled={!isAdmin}>ตั้งตำแหน่ง = พิกัดปัจจุบัน</button><button onClick={getPosition} className="px-3 py-2 rounded-xl bg-neutral-200">รีเฟรชพิกัด</button></div>
        </div>
      </Section>

      <Section title="สาขา">
        <div className="flex gap-2 mb-3"><input placeholder="เพิ่มชื่อสาขา" value={newBranch} onChange={e=>setNewBranch(e.target.value)} className="flex-1 px-3 py-2 border rounded-xl" disabled={!isAdmin} /><button onClick={()=>{ if(!newBranch) return; if(!branches.includes(newBranch)) { setBranches([...branches,newBranch]); setNewBranch(""); } }} className="px-3 py-2 rounded-xl bg-black text-white" disabled={!isAdmin}>+ เพิ่มสาขา</button></div>
        <div className="flex flex-wrap gap-2">{branches.map(b=> (
          <span key={b} className="px-3 py-1 rounded-full bg-neutral-100 border text-sm flex items-center gap-2">
            {b}
            {isAdmin && <button className="text-rose-600" onClick={()=>{
              if(!confirm(`ลบสาขา "${b}" ?`)) return;
              const next = branches.filter(x=>x!==b); setBranches(next);
              const fallback = next[0] || "";
              const bm = {...branchMap};
              for(const emp of Object.keys(bm)){ if(bm[emp]===b) bm[emp]=fallback; }
              setBranchMap(bm);
            }}>×</button>}
          </span>
        ))}</div>
      </Section>

      <Section title="รายชื่อพนักงาน / กะงาน / สาขา / สิทธิ์" right={isAdmin && <button onClick={saveSettings} className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm">บันทึกการตั้งค่า</button>}>
        <div className="flex gap-2 mb-3"><input placeholder="เพิ่มชื่อพนักงาน" value={newEmp} onChange={e=>setNewEmp(e.target.value)} className="flex-1 px-3 py-2 border rounded-xl" disabled={!isAdmin} /><button onClick={()=>{ if(!newEmp) return; if(!employees.includes(newEmp)) { setEmployees([...employees,newEmp]); setShiftMap({...shiftMap,[newEmp]:"A"}); setBranchMap({...branchMap,[newEmp]: branches[0]}); setStatusMap({...statusMap,[newEmp]:"ปกติ"}); setUsers({...users,[newEmp]:{username:"",password:""}}); setNewEmp(""); } }} className="px-3 py-2 rounded-xl bg-black text-white" disabled={!isAdmin}>+ เพิ่ม</button></div>
        <div className="overflow-auto"><table className="min-w-full text-sm"><thead className="bg-neutral-50 sticky top-0"><tr><th className="text-left p-2">ชื่อ</th><th className="text-left p-2">สถานะ</th><th className="text-left p-2">กะงาน</th><th className="text-left p-2">สาขา</th><th className="text-left p-2">Username</th><th className="text-left p-2">Password</th><th className="text-left p-2">การจัดการ</th></tr></thead>
          <tbody>{employees.map(emp=> (<tr key={emp} className="border-t"><td className="p-2">{emp}</td>
            <td className="p-2"><select value={statusMap[emp]||"ปกติ"} onChange={e=>setStatusMap({...statusMap,[emp]:e.target.value})} className="px-2 py-1 border rounded-lg" disabled={!isAdmin}><option>ปกติ</option><option>พ้นสภาพ</option></select></td>
            <td className="p-2"><select value={shiftMap[emp]||"A"} onChange={e=>setShiftMap({...shiftMap, [emp]: e.target.value})} className="px-2 py-1 border rounded-lg" disabled={!isAdmin}>{defaultShifts.map(s=> <option key={s.code} value={s.code}>{s.code} — {s.label}</option>)}</select></td>
            <td className="p-2"><select value={branchMap[emp]||branches[0]} onChange={e=>setBranchMap({...branchMap, [emp]: e.target.value})} className="px-2 py-1 border rounded-lg" disabled={!isAdmin}>{branches.map(b=> <option key={b} value={b}>{b}</option>)}</select></td>
            <td className="p-2"><input value={users[emp]?.username||""} onChange={e=> setUsers({...users, [emp]: { ...(users[emp]||{}), username: e.target.value }})} className="px-2 py-1 border rounded-lg w-36" disabled={!isAdmin} /></td>
            <td className="p-2"><input type="password" value={users[emp]?.password||""} onChange={e=> setUsers({...users, [emp]: { ...(users[emp]||{}), password: e.target.value }})} className="px-2 py-1 border rounded-lg w-36" disabled={!isAdmin} /></td>
            <td className="p-2"><div className="flex gap-2">{isAdmin && <button onClick={()=>{ if(!confirm(`ลบพนักงาน "${emp}" ?`)) return; setEmployees(employees.filter(x=>x!==emp)); const sm={...shiftMap}; delete sm[emp]; setShiftMap(sm); const bm={...branchMap}; delete bm[emp]; setBranchMap(bm); const st={...statusMap}; delete st[emp]; setStatusMap(st); const us={...users}; delete us[emp]; setUsers(us); }} className="px-2 py-1 rounded-lg bg-rose-600 text-white">ลบ</button>}</div></td></tr>))}</tbody></table></div>
      </Section>

      <Section title="อนุมัติใบลา">
        <div className="overflow-auto max-h-[420px]"><table className="min-w-full text-sm"><thead className="bg-neutral-50 sticky top-0"><tr><th className="text-left p-2">ยื่นเมื่อ</th><th className="text-left p-2">พนักงาน</th><th className="text-left p-2">ประเภท</th><th className="text-left p-2">ช่วง</th><th className="text-left p-2">เหตุผล</th><th className="text-left p-2">สถานะ</th><th className="text-left p-2">การจัดการ</th></tr></thead>
          <tbody>{leaveReqs.length===0 && (<tr><td colSpan={8} className="p-4 text-center text-neutral-500">ยังไม่มีคำขอ</td></tr>)}
            {leaveReqs.map(l=> (<tr key={l.id} className="border-t align-top"><td className="p-2 whitespace-nowrap">{toLocal(l.createdAt)}</td><td className="p-2">{l.employee}</td><td className="p-2">{l.leaveType}</td><td className="p-2">{l.startDate} → {l.endDate}<div className="text-xs text-neutral-500">({l.duration})</div></td><td className="p-2 max-w-[260px]">{l.reason||"—"}{l.remarks? <div className="text-xs text-rose-600">Remark: {l.remarks}</div>: null}</td><td className="p-2">{badge(l.status)}</td><td className="p-2"><div className="flex gap-2"><button onClick={()=>{ const copy=[...leaveReqs]; const i=copy.findIndex(x=>x.id===l.id); if(i>=0){ copy[i]={...copy[i], status:"Approved", approver:"HR"}; setLeaveReqs(copy);} }} className="px-2 py-1 rounded-lg bg-green-600 text-white">Approve</button><button onClick={()=>{ const copy=[...leaveReqs]; const i=copy.findIndex(x=>x.id===l.id); if(i>=0){ const r=prompt("เหตุผล Reject"); copy[i]={...copy[i], status:"Rejected", remarks:r||""}; setLeaveReqs(copy);} }} className="px-2 py-1 rounded-lg bg-rose-600 text-white">Reject</button></div></td></tr>))}
          </tbody></table></div>
      </Section>
    </div>
  );
}

function CalcModule({ calcFrom, setCalcFrom, calcTo, setCalcTo, workdaysOnly, setWorkdaysOnly, summaryRows, totalsByEmp, exportCalcCSV }){
  return (
    <div className="grid gap-6">
      <Section title="คำนวณชั่วโมงทำงาน">
        <div className="grid md:grid-cols-4 gap-3 mb-3">
          <div><label className="text-sm text-neutral-600">ตั้งแต่</label><input type="date" value={calcFrom} onChange={e=>setCalcFrom(e.target.value)} className="w-full px-3 py-2 border rounded-xl" /></div>
          <div><label className="text-sm text-neutral-600">ถึง</label><input type="date" value={calcTo} onChange={e=>setCalcTo(e.target.value)} className="w-full px-3 py-2 border rounded-xl" /></div>
          <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={workdaysOnly} onChange={e=>setWorkdaysOnly(e.target.checked)} />ตัดเสาร์-อาทิตย์ออก</label>
          <div className="flex items-end"><button onClick={exportCalcCSV} className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm">Export รายวัน</button></div>
        </div>
        <div className="overflow-auto max-h-[400px]">
          <table className="min-w-full text-sm"><thead className="bg-neutral-50 sticky top-0"><tr><th className="text-left p-2">วันที่</th><th className="text-left p-2">พนักงาน</th><th className="text-left p-2">สาขา</th><th className="text-left p-2">กะ</th><th className="text-left p-2">สถานะ</th><th className="text-left p-2">ชั่วโมงทำงาน</th><th className="text-left p-2">มาสาย</th><th className="text-left p-2">OT</th></tr></thead>
            <tbody>{summaryRows.map((r,i)=> (<tr key={i} className="border-t"><td className="p-2 whitespace-nowrap">{r.date}</td><td className="p-2">{r.employee}</td><td className="p-2">{r.branch||"—"}</td><td className="p-2">{r.shift}</td><td className="p-2">{r.status}</td><td className="p-2">{minutesToHM(r.workedMin)}</td><td className="p-2">{minutesToHM(r.lateMin)}</td><td className="p-2">{minutesToHM(r.otMin)}</td></tr>))}</tbody>
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
  );
}

function DashboardModule({ employees, branches, dashboardRows, dailyAgg, dbFrom, setDbFrom, dbTo, setDbTo, dbEmp, setDbEmp, dbBranch, setDbBranch, exportDashboardCSV, leaveReqs }){
  // build leaveDaily for stacked chart by type
  const leaveDaily = React.useMemo(()=>{
    const map = {};
    for(const l of (leaveReqs||[])){
      if(l.status==="Rejected") continue;
      const from = new Date(l.startDate+"T00:00:00");
      const to = new Date(l.endDate+"T00:00:00");
      for(let d=new Date(from); d<=to; d.setDate(d.getDate()+1)){
        const key = d.toISOString().slice(0,10);
        const m = map[key] || (map[key] = { date:key, sick:0, personal:0, vacation:0, other:0 });
        if(l.leaveType?.includes("ป่วย")) m.sick++;
        else if(l.leaveType?.includes("กิจ")) m.personal++;
        else if(l.leaveType?.includes("พักร้อน")) m.vacation++;
        else m.other++;
      }
    }
    return Object.values(map).sort((a,b)=> a.date.localeCompare(b.date));
  }, [leaveReqs]);

  // quick KPIs
  const kpi = React.useMemo(()=>{
    let late=0, ot=0, absent=0;
    for(const d of dailyAgg){ late+=d.lateMin||0; ot+=d.otMin||0; absent+=d.absent||0; }
    const leaveCount = (leaveReqs||[]).filter(l=> l.status!=="Rejected").length;
    return { late, ot, absent, leaveCount };
  }, [dailyAgg, leaveReqs]);

  return (
    <div className="grid gap-6">
      <Section title="แดชบอร์ด HR (รวมใบลา)" right={<button onClick={exportDashboardCSV} className="px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm">ดาวน์โหลดรายงาน</button>}>
        <div className="grid md:grid-cols-5 gap-3 mb-4">
          <div><label className="text-sm text-neutral-600">ตั้งแต่</label><input type="date" value={dbFrom} onChange={e=>setDbFrom(e.target.value)} className="w-full px-3 py-2 border rounded-xl" /></div>
          <div><label className="text-sm text-neutral-600">ถึง</label><input type="date" value={dbTo} onChange={e=>setDbTo(e.target.value)} className="w-full px-3 py-2 border rounded-xl" /></div>
          <div><label className="text-sm text-neutral-600">พนักงาน</label><select value={dbEmp} onChange={e=>setDbEmp(e.target.value)} className="w-full px-3 py-2 border rounded-xl"><option>ทั้งหมด</option>{employees.map(e=> <option key={e}>{e}</option>)}</select></div>
          <div><label className="text-sm text-neutral-600">สาขา</label><select value={dbBranch} onChange={e=>setDbBranch(e.target.value)} className="w-full px-3 py-2 border rounded-xl"><option>ทั้งหมด</option>{branches.map(b=> <option key={b}>{b}</option>)}</select></div>
        </div>

        <div className="grid md:grid-cols-4 gap-3 mb-2">
          <KPI label="มาสายรวม (นาที)" value={kpi.late} />
          <KPI label="OT รวม (นาที)" value={kpi.ot} />
          <KPI label="ขาดงาน (คน-วัน)" value={kpi.absent} />
          <KPI label="ใบลา (รายการ)" value={kpi.leaveCount} />
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow p-3">
            <div className="font-semibold mb-2">มาสายรวม (นาที) — ตามวัน</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyAgg}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="lateMin" name="มาสาย (นาที)" /></LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow p-3">
            <div className="font-semibold mb-2">OT รวม (นาที) — ตามวัน</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyAgg}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Bar dataKey="otMin" name="OT (นาที)" /></BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow p-3">
            <div className="font-semibold mb-2">ขาดงาน (จำนวนคน) — ตามวัน</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyAgg}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="absent" name="ขาดงาน (คน)" /></LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-3 mt-4">
          <div className="font-semibold mb-2">สรุปใบลา (ตามวัน/ประเภท)</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaveDaily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Legend />
                <Bar dataKey="sick" name="ลาป่วย" />
                <Bar dataKey="personal" name="ลากิจ" />
                <Bar dataKey="vacation" name="ลาพักร้อน" />
                <Bar dataKey="other" name="อื่นๆ" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      <Section title="ตารางข้อมูลหลังกรอง">
        <div className="overflow-auto max-h-[400px]">
          <table className="min-w-full text-sm"><thead className="bg-neutral-50 sticky top-0"><tr><th className="text-left p-2">วันที่</th><th className="text-left p-2">พนักงาน</th><th className="text-left p-2">สาขา</th><th className="text-left p-2">สถานะ</th><th className="text-left p-2">มาสาย(นาที)</th><th className="text-left p-2">OT(นาที)</th></tr></thead>
            <tbody>{dashboardRows.map((r,i)=> (<tr key={i} className="border-t"><td className="p-2 whitespace-nowrap">{r.date}</td><td className="p-2">{r.employee}</td><td className="p-2">{r.branch||"—"}</td><td className="p-2">{r.status}</td><td className="p-2">{r.lateMin}</td><td className="p-2">{r.otMin}</td></tr>))}</tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
function KPI({ label, value }){ return (<div className="p-4 rounded-2xl bg-white shadow"><div className="text-xs text-neutral-500">{label}</div><div className="text-2xl font-bold">{value}</div></div>); }

function LoginModule({ users, statusMap, setCurrentUser, setName }){
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [msg, setMsg] = useState("");
  function doLogin(e){ e.preventDefault();
    const entry = Object.entries(users).find(([emp, cred]) =>
      (cred?.username||"").trim().toLowerCase() === u.trim().toLowerCase() && (cred?.password||"") === p
    );
    if(!entry){ setMsg("บัญชีหรือรหัสผ่านไม่ถูกต้อง"); return; }
    const [emp] = entry; if((statusMap[emp]||"ปกติ")!=="ปกติ"){ setMsg("พนักงานนี้พ้นสภาพแล้ว"); return; }
    const cu = { name: emp, username: u.trim() }; ls.set("currentUser", cu); setCurrentUser(cu); setName(emp); setMsg("เข้าสู่ระบบสำเร็จ");
  }
  return (
    <div className="max-w-md">
      <Section title="เข้าสู่ระบบ">
        <form onSubmit={doLogin} className="grid gap-3">
          <div><label className="text-sm text-neutral-600">Username</label><input value={u} onChange={e=>setU(e.target.value)} className="w-full px-3 py-2 border rounded-xl" /></div>
          <div><label className="text-sm text-neutral-600">Password</label><input type="password" value={p} onChange={e=>setP(e.target.value)} className="w-full px-3 py-2 border rounded-xl" /></div>
          <button className="px-4 py-2 rounded-xl bg-neutral-900 text-white">เข้าสู่ระบบ</button>
          {msg && <div className="text-sm text-neutral-600">{msg}</div>}
        </form>
      </Section>
    </div>
  );
}
