/** Small cached material cues: no network, media decoder or oscillator lifecycle. */
export const cueDurations: Record<string, number> = {
  ui:.045,lift:.06,transfer:.10,flip:.10,draw:.08,recycle:.13,undo:.13,
  invalid:.09,hint:.16,joker:.18,key:.16,unlock:.29,coins:.17,complete:.27,win:.44,
};
export function cueSamples(name: string, sampleRate: number, variant = 0): Float32Array<ArrayBuffer> {
  const duration=cueDurations[name]??cueDurations.ui, data=new Float32Array(Math.ceil(sampleRate*duration));
  let seed=2166136261;for(const c of name)seed=Math.imul(seed^c.charCodeAt(0),16777619);seed^=variant*7919;
  let low=0;
  const noise=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/2147483648-1};
  const bell=(t:number,f:number,decay:number)=>t<0?0:(Math.sin(2*Math.PI*f*t)+.25*Math.sin(2*Math.PI*f*2.71*t)*Math.exp(-t/.025))*.5*Math.min(1,t/.003)*Math.exp(-t/decay);
  const paper=['ui','lift','transfer','flip','draw','recycle','undo'].includes(name);
  const shift=1+(variant-1)*.025;
  for(let i=0;i<data.length;i++){
    const t=i/sampleRate,n=noise();low+=.16*(n-low);let value=0;
    if(paper){
      const weight=name==='ui'?.2:name==='lift'?.28:.47;
      const swipe=name==='flip'||name==='recycle'?Math.exp(-Math.abs(t-.032)/.009):0;
      const root=name==='undo'?540:name==='transfer'?290:430;
      value=weight*((n-low)*(.56*Math.exp(-t/.012)+.24*swipe)+low*.4*Math.exp(-t/.045)+.3*Math.sin(2*Math.PI*shift*(root*t-650*t*t))*Math.exp(-t/.023));
    }else if(name==='invalid')value=.34*(low*.45+Math.sin(2*Math.PI*165*t)*.5)*Math.exp(-t/.025);
    else if(name==='win')for(const [k,f]of [523.25,659.25,783.99,1046.5].entries())value+=.43*bell(t-k*.045,f,.085);
    else if(name==='complete'||name==='unlock')for(const [k,f]of (name==='complete'?[659.25,880,1108.7]:[587.3,739.99,987.77]).entries())value+=.36*bell(t-k*.026,f,.065);
    else if(name==='hint')value=.34*(bell(t,587.3,.04)+bell(t-.055,783.99,.045));
    else value=.57*bell(t,({coins:1260,key:1480,joker:830}[name]??740)*shift,.045);
    const edge=Math.min(1,t/.002,(duration-t)/.012);
    data[i]=Math.max(-.72,Math.min(.72,value*Math.max(0,edge)));
  }
  return data;
}
