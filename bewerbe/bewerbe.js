(function(){var els=document.querySelectorAll('.bw-zahlen strong[data-ziel]');if(!els.length||!('IntersectionObserver' in window))return;
if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
function run(el){var z=+el.dataset.ziel,t0=null,d=900;function f(t){t0=t0||t;var p=Math.min((t-t0)/d,1);el.textContent=Math.round(z*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(f);}el.textContent='0';requestAnimationFrame(f);}
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){run(e.target);io.unobserve(e.target);}});},{threshold:.6});
els.forEach(function(el){io.observe(el);});})();
