import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/api.js';
import { ADMIN_PERMISSIONS, OPERATIONS_PRESET } from '../../../../shared/adminAccess.js';
export default function CoAdminManagement(){
 const [rows,setRows]=useState([]),[next,setNext]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [form,setForm]=useState({name:'',email:'',phone:'',password:'',permissions:[...OPERATIONS_PRESET]});
 const [operation,setOperation]=useState(null),[password,setPassword]=useState(''),[code,setCode]=useState(''),[temporary,setTemporary]=useState('');
 async function load(after=''){try{const data=await apiRequest('/admin/coadmins'+(after?'?after='+encodeURIComponent(after):''));setRows(old=>after?[...old,...data.coadmins]:data.coadmins);setNext(data.nextCursor);}catch(e){setError(e.message);}}
 useEffect(()=>{load();},[]);
 function toggle(key){setForm(old=>({...old,permissions:old.permissions.includes(key)?old.permissions.filter(p=>p!==key):[...old.permissions,key]}));}
 async function submit(event){event.preventDefault();if(busy)return;setBusy(true);setError('');try{
  const body={currentPassword:password,code,...(operation?.kind==='create'?form:operation?.kind==='permissions'?{permissions:form.permissions}:operation?.kind==='reset'?{resetSecurity:true,newPassword:temporary}:{isActive:!operation.user.isActive})};
  const result=await apiRequest('/admin/coadmins'+(operation.kind==='create'?'':'/'+encodeURIComponent(operation.user._id)),{method:operation.kind==='create'?'POST':'PATCH',body:JSON.stringify(body)});
  setMessage(result.message);setOperation(null);setForm({name:'',email:'',phone:'',password:'',permissions:[...OPERATIONS_PRESET]});await load();
 }catch(e){setError(e.message);}finally{setPassword('');setCode('');setTemporary('');setForm(old=>({...old,password:''}));setBusy(false);}}
 const permissions=<fieldset className="space-y-2"><legend>Assigned permissions</legend>{Object.entries(ADMIN_PERMISSIONS).map(([key,label])=><label key={key} className="block"><input type="checkbox" checked={form.permissions.includes(key)} onChange={()=>toggle(key)}/> {label}</label>)}</fieldset>;
 function open(kind,user){if(busy)return;setOperation({kind,user});setPassword('');setCode('');setError('');if(user)setForm(old=>({...old,permissions:user.adminPermissions||[]}));}
 return <section className="space-y-4"><h2 className="text-xl font-bold">Co-admin accounts</h2><p>Each co-admin has an individual password, authenticator and recovery codes. Owner access and financial execution cannot be granted here. Access changes revoke sessions.</p>
 {error&&<p role="alert" className="text-red-700">{error}</p>}{message&&<p role="status">{message}</p>}
 <button type="button" disabled={busy} className="rounded bg-slate-900 text-white p-3" onClick={()=>{setForm({name:'',email:'',phone:'',password:'',permissions:[...OPERATIONS_PRESET]});open('create');}}>Create co-admin</button>
 {operation&&<form aria-label="Confirm co-admin access" onSubmit={submit} className="border rounded-xl p-4 space-y-3 max-w-xl"><h3 className="font-bold">{operation.kind==='create'?'Create co-admin':operation.kind==='permissions'?'Change permissions':operation.kind==='reset'?'Reset co-admin security':'Change account status'}</h3>
 {operation.kind==='create'&&['name','email','phone','password'].map(key=><label key={key} className="block">{key==='password'?'Temporary co-admin password':key}<input required type={key==='password'?'password':key==='email'?'email':'text'} autoComplete={key==='password'?'new-password':'off'} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} className="block border rounded p-2 w-full"/></label>)}
 {['create','permissions'].includes(operation.kind)&&permissions}
 {operation.kind==='reset'&&<label className="block">New temporary password<input required type="password" autoComplete="new-password" value={temporary} onChange={e=>setTemporary(e.target.value)} className="block border p-2 w-full"/></label>}
 <label className="block">Your owner password<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="block border p-2 w-full"/></label>
 <label className="block">Your authenticator or unused recovery code<input required autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} className="block border p-2 w-full"/></label>
 <p>Temporary access expires after 48 hours. Security reset requires the co-admin to change the password and enroll a new authenticator.</p>
 <button disabled={busy} className="rounded bg-slate-900 text-white p-2">Confirm co-admin change</button><button type="button" disabled={busy} onClick={()=>{setOperation(null);setPassword('');setCode('');setTemporary('');setForm(old=>({...old,password:''}));}} className="p-2">Cancel</button></form>}
 <div className="grid sm:grid-cols-2 gap-3">{rows.map(user=><article key={user._id} className="border rounded-xl p-4 space-y-2"><h3 className="font-bold">{user.name}</h3><p>{user.email}</p><p>{user.isActive?'Active':'Disabled'}{user.adminMustChangePassword||!user.mfaEnabled?' - setup required':' - authenticator enabled'}</p><p>{(user.adminPermissions||[]).map(p=>ADMIN_PERMISSIONS[p]).join(', ')||'No operational permissions'}</p><div className="flex flex-wrap gap-3"><button disabled={busy} onClick={()=>open('permissions',user)}>Edit permissions</button><button disabled={busy} onClick={()=>open('status',user)}>{user.isActive?'Disable access':'Enable access'}</button><button disabled={busy} onClick={()=>open('reset',user)}>Reset security</button></div></article>)}</div>
 {next&&<button onClick={()=>load(next)}>More co-admins</button>}</section>;
}
