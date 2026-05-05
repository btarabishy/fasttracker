import { useState, useEffect, useRef, useCallback } from "react";
const MODES={HEALTH:"health",RELIGIOUS:"religious"};
const TABS={HOME:"home",HISTORY:"history",SETTINGS:"settings",PROFILE:"profile"};
const IF_PRESETS=[{label:"16:8",fast:16,eat:8},{label:"18:6",fast:18,eat:6},{label:"20:4",fast:20,eat:4},{label:"OMAD",fast:23,eat:1}];
const STAGES=[{hours:0,label:"Anabolic",color:"#60A5FA",desc:"Fed state - glucose burning"},{hours:4,label:"Catabolic",color:"#34D399",desc:"Insulin falling - fat mobilising"},{hours:8,label:"Fat Burning",color:"#FBBF24",desc:"Glycogen depleted - ketones rising"},{hours:16,label:"Ketosis",color:"#F97316",desc:"Peak fat-burning mode"},{hours:24,label:"Autophagy",color:"#A78BFA",desc:"Cellular repair and regeneration"}];
const HISTORY_DATA=[{id:1,date:"May 10, 2023",hours:16,type:"Health",done:true},{id:2,date:"May 09, 2023",hours:18,type:"Health",done:true},{id:3,date:"May 08, 2023",hours:16,type:"Health",done:true},{id:4,date:"May 07, 2023",hours:0,type:"Health",done:false},{id:5,date:"May 06, 2023",hours:20,type:"Health",done:true},{id:6,date:"May 05, 2023",hours:16,type:"Religious",done:true}];
function pad(n){return String(n).padStart(2,"0");}
function fmt(s){if(s<0)s=0;return pad(Math.floor(s/3600))+":"+pad(Math.floor((s%3600)/60))+":"+pad(s%60);}
function fmtS(s){if(s<0)s=0;return pad(Math.floor(s/3600))+":"+pad(Math.floor((s%3600)/60));}
function getStage(h){let st=STAGES[0];for(const x of STAGES)if(h>=x.hours)st=x;return st;}
function toHHMM(d){return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});}
export default function App(){
  const[screen,setScreen]=useState("onboard");
  const[mode,setMode]=useState(null);
  const[tab,setTab]=useState(TABS.HOME);
  const[preset,setPreset]=useState(IF_PRESETS[0]);
  const[fasting,setFasting]=useState(false);
  const[startMs,setStartMs]=useState(null);
  const[elapsed,setElapsed]=useState(0);
  const[toast,setToast]=useState(null);
  const[history,setHistory]=useState(HISTORY_DATA);
  const[prayer,setPrayer]=useState({fajr:null,maghrib:null,totalSec:52200,loading:false,error:null,city:""});
  const[autoFast,setAutoFast]=useState(false);
  const timerRef=useRef();
  const prevEl=useRef(0);
  const autoRef=useRef();
  const fetchPrayerTimes=useCallback(()=>{
    setPrayer(p=>({...p,loading:true,error:null}));
    if(!navigator.geolocation){setPrayer(p=>({...p,loading:false,error:"Geolocation not supported"}));return;}
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const{latitude:lat,longitude:lng}=pos.coords;
        const today=new Date();
        const dateStr=today.getDate()+"-"+(today.getMonth()+1)+"-"+today.getFullYear();
        const res=await fetch("https://api.aladhan.com/v1/timings/"+dateStr+"?latitude="+lat+"&longitude="+lng+"&method=2");
        const data=await res.json();
        if(data.code===200){
          const timings=data.data.timings;
          const meta=data.data.meta;
          const parseT=(str)=>{const[h,m]=str.split(":").map(Number);const d=new Date();d.setHours(h,m,0,0);return d;};
          const fajrDate=parseT(timings.Fajr);
          const maghribDate=parseT(timings.Maghrib);
          const totalSec=Math.max(1,Math.floor((maghribDate-fajrDate)/1000));
          setPrayer({fajr:fajrDate,maghrib:maghribDate,totalSec,loading:false,error:null,city:meta.timezone||""});
          flash("Prayer times loaded!");
        }else{throw new Error("API error");}
      }catch(e){setPrayer(p=>({...p,loading:false,error:"Could not load prayer times"}));}
    },()=>{setPrayer(p=>({...p,loading:false,error:"Location access denied"}));});
  },[]);
  useEffect(()=>{if(mode===MODES.RELIGIOUS)fetchPrayerTimes();},[mode]);
  useEffect(()=>{
    if(!autoFast||mode!==MODES.RELIGIOUS||!prayer.fajr||!prayer.maghrib)return;
    clearInterval(autoRef.current);
    autoRef.current=setInterval(()=>{
      const now=Date.now();
      const fajrMs=prayer.fajr.getTime();
      const maghribMs=prayer.maghrib.getTime();
      if(now>=fajrMs&&now<maghribMs&&!fasting){setStartMs(fajrMs);setElapsed(Math.floor((now-fajrMs)/1000));setFasting(true);flash("Auto-fast started at Fajr");}
      if(now>=maghribMs&&fasting){const hrs=Math.floor((maghribMs-fajrMs)/1000);setHistory(h=>[{id:Date.now(),date:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),hours:+(hrs/3600).toFixed(1),type:"Religious",done:true},...h]);setFasting(false);setElapsed(0);flash("Auto-fast ended at Maghrib!");}
    },5000);
    return()=>clearInterval(autoRef.current);
  },[autoFast,mode,prayer,fasting]);
  useEffect(()=>{if(fasting){timerRef.current=setInterval(()=>setElapsed(Math.floor((Date.now()-startMs)/1000)),1000);}else clearInterval(timerRef.current);return()=>clearInterval(timerRef.current);},[fasting,startMs]);
  useEffect(()=>{if(!fasting)return;const tot=mode===MODES.RELIGIOUS?prayer.totalSec:preset.fast*3600;if(elapsed===Math.floor(tot/2)&&prevEl.current<Math.floor(tot/2))flash("Halfway there!");if(elapsed>=tot&&prevEl.current<tot)flash("Fast complete! Well done!");prevEl.current=elapsed;},[elapsed]);
  function flash(m){setToast(m);setTimeout(()=>setToast(null),3500);}
  function startFast(){setStartMs(Date.now());setElapsed(0);setFasting(true);flash("Fast started!");}
  function endFast(){if(!fasting)return;const hrs=+(elapsed/3600).toFixed(1);setHistory(h=>[{id:Date.now(),date:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),hours:hrs,type:mode===MODES.HEALTH?"Health":"Religious",done:hrs>=(mode===MODES.HEALTH?preset.fast:prayer.totalSec/3600)},...h]);setFasting(false);setElapsed(0);flash("Saved "+hrs+"h!");}
  function switchMode(){setFasting(false);setElapsed(0);clearInterval(timerRef.current);clearInterval(autoRef.current);setAutoFast(false);setScreen("onboard");}
  const prayerFajr=prayer.fajr||new Date(new Date().setHours(5,12,0,0));
  const prayerMaghrib=prayer.maghrib||new Date(new Date().setHours(19,47,0,0));
  const totalSec=mode===MODES.RELIGIOUS?prayer.totalSec:preset.fast*3600;
  const remaining=Math.max(0,totalSec-elapsed);
  const progress=Math.min(1,elapsed/totalSec);
  const stage=getStage(elapsed/3600);
  const ringColor=fasting?stage.color:"#3A3A4A";
  const R=80,CIR=2*Math.PI*R,drawn=CIR*progress;
  const phone={width:390,minHeight:844,margin:"0 auto",background:"#09090F",fontFamily:"-apple-system,BlinkMacSystemFont,sans-serif",color:"#fff",position:"relative",overflow:"hidden",borderRadius:52,boxShadow:"0 40px 100px rgba(0,0,0,0.8)",display:"flex",flexDirection:"column"};
  if(screen==="onboard")return(<div style={phone}><SBar/><Onboard onSelect={m=>{setMode(m);setScreen("main");}}/></div>);
  return(<div style={phone}>
    <SBar/>
    {toast&&<Toast msg={toast}/>}
    <div style={{flex:1,overflowY:"auto",paddingBottom:88}}>
      {tab===TABS.HOME&&<Home mode={mode} fasting={fasting} elapsed={elapsed} remaining={remaining} progress={progress} preset={preset} setPreset={setPreset} stage={stage} ringColor={ringColor} R={R} CIR={CIR} drawn={drawn} startFast={startFast} endFast={endFast} prayer={prayer} prayerFajr={prayerFajr} prayerMaghrib={prayerMaghrib} fmt={fmt} fmtS={fmtS} toHHMM={toHHMM} switchMode={switchMode} autoFast={autoFast} setAutoFast={setAutoFast} fetchPrayerTimes={fetchPrayerTimes}/>}
      {tab===TABS.HISTORY&&<History history={history}/>}
      {tab===TABS.SETTINGS&&<Settings mode={mode} setMode={setMode} preset={preset} setPreset={setPreset} autoFast={autoFast} setAutoFast={setAutoFast} switchMode={switchMode} fetchPrayerTimes={fetchPrayerTimes} prayer={prayer}/>}
      {tab===TABS.PROFILE&&<Profile history={history}/>}
    </div>
    <TBar tab={tab} setTab={setTab}/>
  </div>);}
function SBar(){return(<div style={{padding:"14px 28px 0",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,fontWeight:600,flexShrink:0}}><span>9:41</span><div style={{width:126,height:34,background:"#09090F",borderRadius:20,border:"1.5px solid #1e1e2a",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:68,height:5,background:"#1a1a2a",borderRadius:4}}/></div><span style={{fontSize:11}}>Battery</span></div>);}
function Toast({msg}){return(<div style={{position:"absolute",top:64,left:20,right:20,zIndex:99,background:"rgba(255,255,255,0.12)",backdropFilter:"blur(24px)",borderRadius:16,padding:"13px 18px",fontSize:14,fontWeight:500,border:"1px solid rgba(255,255,255,0.18)",textAlign:"center",color:"#fff"}}>{msg}</div>);}
function Onboard({onSelect}){return(<div style={{flex:1,display:"flex",flexDirection:"column",padding:"32px 28px 40px",gap:24}}>
  <div style={{textAlign:"center",paddingTop:12}}><div style={{fontSize:52}}>T</div><h1 style={{margin:"10px 0 0",fontSize:28,fontWeight:800}}>Welcome to FastTracker</h1><p style={{margin:"10px 0 0",fontSize:15,color:"#888",lineHeight:1.5}}>Your personal fasting companion. Choose your journey to get started.</p></div>
  <div style={{display:"flex",flexDirection:"column",gap:14,marginTop:8}}>
    <OCard title="Health" badge="Wellness" desc="Intermittent fasting for health and metabolic goals." accent="#60A5FA" onClick={()=>onSelect(MODES.HEALTH)}/>
    <OCard title="Religious" badge="Ramadan" desc="Auto prayer times based on your GPS location." accent="#A78BFA" onClick={()=>onSelect(MODES.RELIGIOUS)}/>
  </div>
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:"auto",color:"#555",fontSize:13}}><span style={{width:8,height:8,borderRadius:4,background:"#60A5FA",display:"inline-block"}}/>1 Onboarding Step</div>
</div>);}
function OCard({title,badge,desc,accent,onClick}){const[h,sH]=useState(false);return(<button onClick={onClick} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)} style={{background:h?accent+"18":"rgba(255,255,255,0.04)",border:"1.5px solid "+(h?accent+"55":"rgba(255,255,255,0.09)"),borderRadius:20,padding:"20px 22px",textAlign:"left",cursor:"pointer",color:"#fff",transition:"all 0.2s",display:"flex",alignItems:"center",gap:14,width:"100%"}}>
  <div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}><span style={{fontSize:18,fontWeight:700}}>{title}</span><span style={{fontSize:11,fontWeight:600,color:accent,background:accent+"20",borderRadius:8,padding:"2px 8px"}}>{badge}</span></div><div style={{fontSize:13,color:"#777",lineHeight:1.4}}>{desc}</div></div>
  <span style={{color:accent,fontSize:22}}>{">"}</span>
</button>);}
function Home({mode,fasting,elapsed,remaining,progress,preset,setPreset,stage,ringColor,R,CIR,drawn,startFast,endFast,prayer,prayerFajr,prayerMaghrib,fmt,fmtS,toHHMM,switchMode,autoFast,setAutoFast,fetchPrayerTimes}){
  const[showP,setShowP]=useState(false);
  const now=new Date();const isR=mode===MODES.RELIGIOUS;
  return(<div style={{padding:"18px 24px 0"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
      <div><h2 style={{margin:0,fontSize:22,fontWeight:800}}>FastTracker</h2><p style={{margin:"3px 0 0",fontSize:13,color:"#555"}}>{now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p></div>
      <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
        <div style={{background:fasting?ringColor+"18":"rgba(255,255,255,0.05)",border:"1px solid "+(fasting?ringColor+"33":"rgba(255,255,255,0.08)"),borderRadius:20,padding:"5px 12px",fontSize:12,fontWeight:600,color:fasting?ringColor:"#555",display:"flex",alignItems:"center",gap:5}}><span style={{width:6,height:6,borderRadius:3,background:fasting?ringColor:"#444",display:"inline-block"}}/>{fasting?"Fasting":"Eating"}</div>
        <button onClick={switchMode} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"4px 10px",fontSize:11,color:"#aaa",cursor:"pointer",fontWeight:600}}>Switch Mode</button>
      </div>
    </div>
    {isR&&prayer.loading&&<div style={{background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#A78BFA",textAlign:"center"}}>Detecting your location...</div>}
    {isR&&prayer.error&&<div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:13,color:"#EF4444",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>{prayer.error}</span><button onClick={fetchPrayerTimes} style={{background:"rgba(239,68,68,0.2)",border:"none",borderRadius:8,padding:"4px 10px",color:"#EF4444",cursor:"pointer",fontSize:12,fontWeight:600}}>Retry</button></div>}
    {isR&&prayer.city&&!prayer.loading&&!prayer.error&&<div style={{background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.15)",borderRadius:12,padding:"8px 14px",marginBottom:12,fontSize:12,color:"#A78BFA",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>Location: {prayer.city}</span><button onClick={fetchPrayerTimes} style={{background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:11}}>Refresh</button></div>}
    <div style={{display:"flex",justifyContent:"center",marginBottom:18}}>
      <div style={{position:"relative",width:220,height:220}}>
        <svg width="220" height="220" viewBox="0 0 200 200"><circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14"/><circle cx="100" cy="100" r={R} fill="none" stroke={ringColor} strokeWidth="14" strokeLinecap="round" strokeDasharray={drawn+" "+(CIR-drawn)} strokeDashoffset={CIR/4} style={{transition:"stroke-dasharray 0.9s ease,stroke 0.8s ease"}}/></svg>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
          <span style={{fontSize:11,color:"#555",letterSpacing:1,fontWeight:600}}>{fasting?"TIME REMAINING":"READY TO FAST"}</span>
          <span style={{fontSize:36,fontWeight:800,letterSpacing:-1}}>{fasting?fmtS(remaining):pad(preset.fast)+":00"}</span>
          {fasting&&<span style={{fontSize:11,fontWeight:600,color:ringColor,marginTop:2}}>{isR?"Until Iftar":stage.label}</span>}
          {!fasting&&isR&&autoFast&&<span style={{fontSize:10,color:"#A78BFA",marginTop:2}}>Auto-fast ON</span>}
        </div>
      </div>
    </div>
    <div style={{display:"flex",justifyContent:"space-around",marginBottom:16}}>
      {!isR?<><Stamp l="STARTED" v={fasting?new Date(Date.now()-elapsed*1000).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"--"}/><Stamp l="ELAPSED" v={fmt(elapsed)} c={ringColor}/><Stamp l="TARGET" v={preset.fast+"h"}/></>:<><Stamp l="FAJR" v={toHHMM(prayerFajr)}/><Stamp l="PROGRESS" v={Math.round(progress*100)+"%"} c="#A78BFA"/><Stamp l="MAGHRIB" v={toHHMM(prayerMaghrib)}/></>}
    </div>
    {!isR&&fasting&&<div style={{background:ringColor+"18",border:"1px solid "+ringColor+"33",borderRadius:14,padding:"11px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}><div style={{width:8,height:8,borderRadius:4,background:ringColor,flexShrink:0}}/><div><div style={{fontSize:14,fontWeight:700,color:ringColor}}>{stage.label}</div><div style={{fontSize:12,color:"#666",marginTop:1}}>{stage.desc}</div></div><div style={{marginLeft:"auto",fontSize:12,color:"#555"}}>{(elapsed/3600).toFixed(1)}h elapsed</div></div>}
    {isR&&<div style={{background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:14,padding:"14px 18px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{textAlign:"center"}}><div style={{fontSize:18}}>Sunrise</div><div style={{fontSize:11,color:"#666"}}>Fajr</div><div style={{fontSize:13,fontWeight:700}}>{toHHMM(prayerFajr)}</div></div>
        <div style={{flex:1,height:4,background:"rgba(167,139,250,0.2)",borderRadius:2,overflow:"hidden",margin:"0 14px"}}><div style={{width:Math.round(progress*100)+"%",height:"100%",background:"linear-gradient(90deg,#7C3AED,#A78BFA)",transition:"width 1s ease",borderRadius:2}}/></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:18}}>Sunset</div><div style={{fontSize:11,color:"#666"}}>Maghrib</div><div style={{fontSize:13,fontWeight:700}}>{toHHMM(prayerMaghrib)}</div></div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid rgba(167,139,250,0.15)",paddingTop:10}}>
        <div><div style={{fontSize:13,fontWeight:600,color:"#ddd"}}>Auto-Fast</div><div style={{fontSize:11,color:"#666",marginTop:1}}>Starts at Fajr, ends at Maghrib</div></div>
        <Tog on={autoFast} set={setAutoFast} color="#A78BFA"/>
      </div>
    </div>}
    {!isR&&<div style={{marginBottom:16}}><button onClick={()=>setShowP(!showP)} style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:14,padding:"13px 16px",color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",fontSize:14}}><span style={{color:"#888"}}>Protocol</span><span style={{fontWeight:700,flex:1,textAlign:"center"}}>{preset.label+" - "+preset.fast+"h fast"}</span><span style={{color:"#555",fontSize:12}}>{showP?"^":"v"}</span></button>{showP&&<div style={{background:"#111118",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,marginTop:4,overflow:"hidden"}}>{IF_PRESETS.map(p=><button key={p.label} onClick={()=>{setPreset(p);setShowP(false);}} style={{width:"100%",padding:"13px 18px",background:"none",border:"none",borderBottom:"1px solid rgba(255,255,255,0.05)",color:preset.label===p.label?"#60A5FA":"#ccc",textAlign:"left",cursor:"pointer",fontSize:14,fontWeight:preset.label===p.label?700:400}}>{p.label+" - "+p.fast+"h fast / "+p.eat+"h eat"+(preset.label===p.label?" (selected)":"")}</button>)}</div>}</div>}
    <div style={{display:"flex",gap:12,marginBottom:8}}>
      <button onClick={startFast} disabled={fasting||(isR&&autoFast)} style={{flex:1,padding:"16px 0",borderRadius:16,border:"none",cursor:(fasting||(isR&&autoFast))?"not-allowed":"pointer",background:(fasting||(isR&&autoFast))?"rgba(255,255,255,0.07)":"#fff",color:(fasting||(isR&&autoFast))?"#444":"#000",fontSize:16,fontWeight:700}}>{isR&&autoFast?"Auto Mode ON":"Start Fast"}</button>
      <button onClick={endFast} disabled={!fasting} style={{flex:1,padding:"16px 0",borderRadius:16,background:"transparent",color:!fasting?"#444":"#fff",border:"1.5px solid "+(!fasting?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.35)"),fontSize:16,fontWeight:700,cursor:!fasting?"not-allowed":"pointer"}}>End Fast</button>
    </div>
  </div>);}
function Stamp({l,v,c}){return(<div style={{textAlign:"center"}}><div style={{fontSize:11,color:"#555",marginBottom:3}}>{l}</div><div style={{fontSize:15,fontWeight:700,color:c||"#fff"}}>{v}</div></div>);}
function Tog({on,set,color}){const c=color||"#60A5FA";return(<div onClick={()=>set(!on)} style={{width:44,height:26,borderRadius:13,cursor:"pointer",background:on?c:"#2a2a3a",transition:"background 0.2s",position:"relative",flexShrink:0}}><div style={{position:"absolute",top:3,left:on?21:3,width:20,height:20,borderRadius:10,background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.4)"}}/></div>);}
function History({history}){
  const done=history.filter(h=>h.done);const total=done.reduce((a,h)=>a+h.hours,0);const longest=Math.max(...history.map(h=>h.hours),0);
  return(<div style={{padding:"20px 24px 0"}}><h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>Fast History</h2><p style={{margin:"0 0 18px",fontSize:13,color:"#555"}}>Your fasting record</p>
    <div style={{display:"flex",gap:10,marginBottom:20}}>{[{l:"Streak",v:done.length+"d",c:"#60A5FA"},{l:"Longest",v:longest+"h",c:"#34D399"},{l:"Total",v:total.toFixed(0)+"h",c:"#FBBF24"}].map(s=><div key={s.l} style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"12px 10px",textAlign:"center"}}><div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:"#555",marginTop:3}}>{s.l}</div></div>)}</div>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>{history.map(h=>{const c=h.type==="Health"?"#60A5FA":"#A78BFA";return(<div key={h.id} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}><div style={{width:36,height:36,borderRadius:10,background:c+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:c,flexShrink:0}}>{h.type==="Health"?"H":"R"}</div><div style={{flex:1}}><div style={{fontSize:14,fontWeight:700}}>{h.date}</div><div style={{fontSize:12,color:"#555",marginTop:2}}>{h.done?h.hours+"h completed":"Skipped"}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:12,fontWeight:600,color:c,background:c+"15",borderRadius:8,padding:"3px 9px"}}>{h.type}</div><div style={{fontSize:11,color:h.done?"#34D399":"#EF4444",marginTop:4,fontWeight:600}}>{h.done?"Done":"Skipped"}</div></div></div>);})}</div>
  </div>);}
function Settings({mode,setMode,preset,setPreset,autoFast,setAutoFast,switchMode,fetchPrayerTimes,prayer}){
  const[n,sN]=useState(true);const[ha,sHa]=useState(false);const[d,sD]=useState(true);
  return(<div style={{padding:"20px 24px 0"}}><h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>Settings</h2><p style={{margin:"0 0 20px",fontSize:13,color:"#555"}}>Customize your experience</p>
    <Sec title="Fasting Mode">
      <Row label="Health and Wellness" right={<Radio checked={mode===MODES.HEALTH} onClick={()=>setMode(MODES.HEALTH)}/>}/>
      <Row label="Religious (Ramadan)" right={<Radio checked={mode===MODES.RELIGIOUS} onClick={()=>setMode(MODES.RELIGIOUS)}/>}/>
      <Row label="Switch Mode" right={<button onClick={switchMode} style={{background:"rgba(96,165,250,0.15)",border:"none",borderRadius:10,padding:"5px 12px",color:"#60A5FA",cursor:"pointer",fontSize:12,fontWeight:700}}>Go</button>}/>
    </Sec>
    {mode===MODES.RELIGIOUS&&<Sec title="Ramadan Settings">
      <Row label="Prayer Times" right={<button onClick={fetchPrayerTimes} style={{background:"rgba(167,139,250,0.15)",border:"none",borderRadius:10,padding:"5px 12px",color:"#A78BFA",cursor:"pointer",fontSize:12,fontWeight:700}}>{prayer.loading?"Loading...":"Refresh"}</button>}/>
      <Row label="Auto-Fast (Fajr to Maghrib)" right={<Tog on={autoFast} set={setAutoFast} color="#A78BFA"/>}/>
    </Sec>}
    {mode===MODES.HEALTH&&<Sec title="IF Protocol">{IF_PRESETS.map(p=><Row key={p.label} label={p.label+" - "+p.fast+"h fast"} right={<Radio checked={preset.label===p.label} onClick={()=>setPreset(p)}/>}/>)}</Sec>}
    <Sec title="Preferences"><Row label="Notifications" right={<Tog on={n} set={sN}/>}/><Row label="Apple Health" right={<Tog on={ha} set={sHa}/>}/><Row label="Dark Mode" right={<Tog on={d} set={sD}/>}/></Sec>
    <Sec title="Account"><Row label="Upgrade to Pro" right={<span style={{fontSize:12,color:"#FBBF24",fontWeight:700}}>$2.99/mo</span>}/><Row label="Export Data" right={<span style={{fontSize:12,color:"#555"}}>{">"}</span>}/><Row label="About" right={<span style={{fontSize:12,color:"#555"}}>v1.0.0</span>}/></Sec>
  </div>);}
function Sec({title,children}){return(<div style={{marginBottom:20}}><div style={{fontSize:12,color:"#555",fontWeight:600,letterSpacing:0.8,textTransform:"uppercase",marginBottom:8}}>{title}</div><div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,overflow:"hidden"}}>{children}</div></div>);}
function Row({label,right}){return(<div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,0.05)"}}><span style={{fontSize:14,color:"#ddd"}}>{label}</span>{right}</div>);}
function Radio({checked,onClick}){return(<div onClick={onClick} style={{width:22,height:22,borderRadius:11,border:"2px solid "+(checked?"#60A5FA":"#444"),background:checked?"#60A5FA":"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{checked&&<span style={{color:"#000",fontSize:11,fontWeight:800}}>✓</span>}</div>);}
function Profile({history}){
  const done=history.filter(h=>h.done);const total=done.reduce((a,h)=>a+h.hours,0);
  return(<div style={{padding:"20px 24px 0"}}><h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:800}}>Profile</h2><p style={{margin:"0 0 20px",fontSize:13,color:"#555"}}>Your fasting journey</p>
    <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:18,padding:"16px 18px"}}><div style={{width:56,height:56,borderRadius:28,background:"linear-gradient(135deg,#60A5FA,#A78BFA)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:"#fff"}}>AT</div><div><div style={{fontSize:18,fontWeight:700}}>Ahmad</div><div style={{fontSize:13,color:"#555",marginTop:2}}>FastTracker Pro</div></div><div style={{marginLeft:"auto",background:"rgba(251,191,36,0.15)",borderRadius:10,padding:"4px 10px",fontSize:12,color:"#FBBF24",fontWeight:700}}>PRO</div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>{[{l:"Fasts Done",v:done.length},{l:"Total Hours",v:total.toFixed(0)+"h"},{l:"Streak",v:done.length+"d"},{l:"Best Fast",v:Math.max(...done.map(h=>h.hours),0)+"h"}].map(s=><div key={s.l} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:"16px"}}><div style={{fontSize:20,fontWeight:800}}>{s.v}</div><div style={{fontSize:11,color:"#555",marginTop:1}}>{s.l}</div></div>)}</div>
    <Sec title="Achievements">{[{l:"First Fast",done:true},{l:"3-Day Streak",done:true},{l:"7-Day Streak",done:false},{l:"24-Hour Fast",done:false}].map(a=><Row key={a.l} label={<span style={{opacity:a.done?1:0.4}}>{a.l}</span>} right={<span style={{fontSize:14}}>{a.done?"Done":"Locked"}</span>}/>)}</Sec>
  </div>);}
function TBar({tab,setTab}){return(<div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(9,9,15,0.95)",backdropFilter:"blur(30px)",borderTop:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-around",padding:"10px 0 24px"}}>{[{id:TABS.HOME,l:"Home"},{id:TABS.HISTORY,l:"History"},{id:TABS.SETTINGS,l:"Settings"},{id:TABS.PROFILE,l:"Profile"}].map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",color:tab===t.id?"#60A5FA":"#444",display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontSize:10,fontWeight:600,cursor:"pointer",padding:"4px 16px",transition:"color 0.2s"}}>{t.l}</button>)}</div>);}
