];
function startNet(sc){ const def=sc.def(); const N=Net(def); N._start=def.start||null; const ses={}; for(const [k,d] of Object.entries(N.dev)) if(d.type!=="hub") ses[k]= (d.type==="pc"||d.type==="server")? PCSession(d,N) : Session(d); return {N,ses}; }

