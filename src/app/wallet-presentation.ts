import {createValueTransferPlan,valueTransferEmissionDelay,valueAfterVisualArrival,shouldPlayValueTransferCue} from '@danilah/mini-games-kit/core';

/** Presentation of already durable coins. Spending/entitlement always uses SaveStore. */
export class WalletPresentation {
  private target:number;private value:number;private goal:number;private reserved:number;private raf=0;private last=0;
  private flights:{node:HTMLElement;start:number;duration:number;credit:number;sounded:boolean;sound:boolean;path:{x:number,y:number}[]}[]=[];
  private afterLanding?: () => void;
  private debit?: HTMLElement;
  private debitFrame = 0;
  private debitTimeout = 0;
  private pool:HTMLElement[]=[];private receipt?:{node:HTMLElement;amount:number;start:number};private pulse?:Animation;
  constructor(total:number,private layer:HTMLElement,private counter:HTMLElement,private helper:HTMLElement,private wallet:HTMLElement,private land:(animated: boolean)=>void,private reduced:()=>boolean){
    this.target=this.value=this.goal=this.reserved=total;
    this.pool=Array.from({length:12},()=>{const node=document.createElement('span');node.className='flying-coin';node.setAttribute('aria-hidden','true');layer.append(node);return node;});this.paint();
  }
  get active(){return this.flights.length>0;}
  /** A following panel must not cancel an income batch before its last arrival/count. */
  get settling(){return this.flights.length>0||this.value!==this.goal;}
  get pending(){return Math.max(0,this.target-this.reserved);}
  sync(total:number,defer=false){
    if(total===this.target)return;
    if(total<this.target){
      const spent = this.target - total;
      this.target = total;
      this.cancel();
      this.showDebit(spent);
      return;
    }
    this.target=total;if(!defer)this.collect(this.wallet);
  }
  private showDebit(amount: number) {
    this.clearDebit(true);
    // The confirmed action can close its sheet before the next paint.
    this.debitFrame = requestAnimationFrame(() => {
      this.debitFrame = 0;
      if (document.hidden) return;
      const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
      const anchor = !dialog || dialog.contains(this.wallet)
        ? this.wallet : dialog.querySelector<HTMLElement>('[data-wallet-balance]');
      if (!anchor?.getClientRects().length) return;

      const badge = document.createElement('span');
      badge.className = 'coin-debit';
      badge.setAttribute('role', 'status');
      badge.setAttribute('aria-label', `Списано ${amount} монет`);
      badge.textContent = `−${new Intl.NumberFormat('ru-RU').format(amount)}`;
      anchor.append(badge);
      this.debit = badge;
      this.debitTimeout = window.setTimeout(() => this.clearDebit(), 1000);
    });
  }
  clearDebit(cancelPending = false) {
    if (cancelPending) {
      cancelAnimationFrame(this.debitFrame);
      this.debitFrame = 0;
    }
    clearTimeout(this.debitTimeout);
    this.debit?.remove();
    this.debit = undefined;
  }
  collect(origin:HTMLElement,limit=this.pending,onLanding?: () => void){
    const amount=Math.min(this.pending,limit);if(!amount){onLanding?.();return;}this.reserved+=amount;
    if(this.reduced()){this.value=this.goal=Math.min(this.target,this.goal+amount);this.paint();this.land(false);onLanding?.();return;}
    const source=origin.getBoundingClientRect(),icon=this.wallet.querySelector('.coin-icon')??this.wallet,dest=icon.getBoundingClientRect();
    const sx=source.x+source.width/2,sy=source.y+source.height/2,tx=dest.x+dest.width/2,ty=dest.y+dest.height/2;
    const badge=document.createElement('span');badge.className='coin-gain';badge.textContent=`+${amount}`;badge.setAttribute('role','status');badge.setAttribute('aria-label',`Получено ${amount} монет`);badge.style.left=`${Math.max(30,Math.min(innerWidth-55,sx))}px`;badge.style.top=`${Math.max(20,sy-22)}px`;this.layer.append(badge);
    const animation=badge.animate([{opacity:0,transform:'translate(-50%,0) scale(.85)'},{opacity:1,transform:'translate(-50%,-10px) scale(1.1)',offset:.18},{opacity:1,offset:.7},{opacity:0,transform:'translate(-50%,-22px) scale(1)'}],{duration:950});animation.onfinish=()=>badge.remove();animation.oncancel=()=>badge.remove();
    const available=this.pool.filter(n=>!this.flights.some(f=>f.node===n));
    if(!available.length){this.goal=Math.min(this.target,this.goal+amount);this.run();onLanding?.();return;}
    if (onLanding) this.afterLanding = onLanding;
    const plan=createValueTransferPlan(amount,{minDurationMs:650,maxDurationMs:900,maxVisualTokens:Math.min(8,available.length),maxAudioEvents:4,flightBaseMs:480,maxFlightDurationMs:560,flightPerVisualTokenMs:5});
    const dialog=origin.closest('dialog'),r=dialog?.getBoundingClientRect();const side=r?Math.min(innerWidth-12,r.right+6):sx;
    let previous=0;const now=performance.now();
    for(let i=0;i<plan.visualTokenCount;i++){
      const credit=valueAfterVisualArrival(plan,i)-previous;previous+=credit;const node=available[i];node.style.display='block';node.style.opacity='0';
      this.flights.push({node,start:now+valueTransferEmissionDelay(plan,i),duration:plan.flightDurationMs,credit,sounded:false,sound:shouldPlayValueTransferCue(plan,i),path:r?[{x:sx,y:sy},{x:side,y:sy-8},{x:side,y:Math.min(ty+10,r.top-22)},{x:tx,y:ty}]:[{x:sx+(i%3-1)*5,y:sy},{x:(sx+tx)/2,y:Math.min(sy,ty)+24},{x:tx,y:ty}]});
    }
    this.run();
  }
  reveal(node:HTMLElement,amount:number){
    if(this.reduced()){node.textContent=`+${amount}`;return;}
    this.receipt={node,amount,start:performance.now()};node.textContent='+0';this.run();
  }
  cancel(settle=true){
    cancelAnimationFrame(this.raf);this.raf=0;
    for(const f of this.flights)f.node.style.display='none';this.flights=[];
    this.layer.querySelectorAll('.coin-gain').forEach(e=>e.remove());this.pulse?.cancel();
    if(this.receipt){this.receipt.node.textContent=`+${this.receipt.amount}`;this.receipt=undefined;}
    if(settle)this.value=this.goal=this.reserved=this.target;else { this.value=this.goal=this.reserved; }
    this.paint();
    this.finishLanding();
  }
  private finishLanding() {
    const callback = this.afterLanding;
    this.afterLanding = undefined;
    callback?.();
  }
  dispose(){this.clearDebit(true);this.cancel();this.pool.forEach(n=>n.remove());}
  private paint(){const n=Math.round(this.value);this.counter.textContent=n<100000?String(n):new Intl.NumberFormat('ru-RU',{notation:'compact',maximumFractionDigits:1}).format(n);this.helper.textContent=`${n} монет`;}
  private run(){if(!this.raf){this.last=performance.now();this.raf=requestAnimationFrame(t=>this.tick(t));}}
  private tick(now:number){
    this.raf=0;const dt=Math.min(50,now-this.last);this.last=now;
    this.flights=this.flights.filter(f=>{const p=(now-f.start)/f.duration;if(p<0)return true;if(p>=1){f.node.style.display='none';this.goal=Math.min(this.target,this.goal+f.credit);if(f.sound)this.land(true);if(!this.reduced()){this.pulse?.cancel();this.pulse=(this.wallet.querySelector('.coin-icon')??this.wallet).animate([{transform:'scale(1)'},{transform:'scale(1.07)',offset:.4},{transform:'scale(1)'}],{duration:180});}return false;}
      const t=p*p*(3-2*p),segments=f.path.length-1,index=Math.min(segments-1,Math.floor(t*segments)),q=t*segments-index,a=f.path[index],b=f.path[index+1];
      f.node.style.opacity=String(Math.min(1,p*8,(1-p)*12));f.node.style.transform=`translate(${a.x+(b.x-a.x)*q-10}px,${a.y+(b.y-a.y)*q-10}px) scale(${.85+.15*Math.sin(p*Math.PI)})`;return true;});
    if (!this.flights.length) this.finishLanding();
    this.value+=(this.goal-this.value)*(1-Math.exp(-dt/65));if(Math.abs(this.value-this.goal)<.05)this.value=this.goal;this.paint();
    if(this.receipt){const p=Math.min(1,(now-this.receipt.start)/460);this.receipt.node.textContent=`+${Math.round(this.receipt.amount*(1-Math.pow(1-p,3)))}`;if(p===1)this.receipt=undefined;}
    if(this.flights.length||this.value!==this.goal||this.receipt)this.raf=requestAnimationFrame(t=>this.tick(t));
  }
}
