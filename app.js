const stocks=[
{name:'NTT',ticker:'9432',type:'core',summary:'通信インフラを土台に、少額で積み上げやすい大型株。',point:'安定したキャッシュ創出と株主還元。成長投資が利益につながるかを見る。',risk:'通信料金競争、規制、巨額投資の回収遅れ。',judge:'買い候補'},
{name:'三菱商事',ticker:'8058',type:'core',summary:'多様な事業と資源を持つ日本の代表的な総合商社。',point:'非資源分野の利益成長と株主還元。',risk:'資源価格や世界景気の変動。',judge:'待つ'},
{name:'ベイカレント',ticker:'6532',type:'core',summary:'高成長を続ける国内コンサルティング企業。',point:'売上成長、人材採用、利益率の持続性。',risk:'人材獲得競争と成長鈍化。',judge:'保有継続'},
{name:'PKSHA Technology',ticker:'3993',type:'dream',summary:'AIアルゴリズムを企業の業務に実装する成長企業。',point:'AI需要を継続収益へ変えられるか。',risk:'高い期待が株価に織り込まれること。',judge:'調査継続'},
{name:'Astroscale',ticker:'186A',type:'dream',summary:'宇宙ごみ除去など軌道上サービスを狙う宇宙企業。',point:'大型契約、技術実証、商用化の進展。',risk:'赤字継続、開発遅延、資金調達。',judge:'夢枠候補'},
{name:'Rocket Lab',ticker:'RKLB',type:'dream',summary:'打上げだけでなく宇宙システム全体を手がける米国企業。',point:'次世代ロケットと宇宙システム事業の伸び。',risk:'開発失敗、競争、資金需要。',judge:'夢枠候補'}
];
const list=document.querySelector('#stockList'),count=document.querySelector('#count'),modal=document.querySelector('#detailModal');
function label(t){return t==='core'?'大型株枠':'夢枠'}
function render(filter='all'){
 const data=filter==='all'?stocks:stocks.filter(s=>s.type===filter); count.textContent=`${data.length}社`;
 list.innerHTML=data.map((s,i)=>`<button class="stock" data-name="${s.name}"><span class="logo">${s.name.slice(0,1)}</span><span class="meta"><h3>${s.name}</h3><p>${s.ticker} · ${label(s.type)}</p></span><span class="judge">${s.judge}</span></button>`).join('');
 list.querySelectorAll('.stock').forEach(b=>b.onclick=()=>openDetail(stocks.find(s=>s.name===b.dataset.name)));
}
function openDetail(s){
 document.querySelector('#detailTicker').textContent=s.ticker;document.querySelector('#detailName').textContent=s.name;document.querySelector('#detailBadge').textContent=label(s.type);document.querySelector('#detailSummary').textContent=s.summary;document.querySelector('#detailPoint').textContent=s.point;document.querySelector('#detailRisk').textContent=s.risk;document.querySelector('#detailJudge').textContent=s.judge;modal.showModal();
}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelector('.tab.active').classList.remove('active');t.classList.add('active');render(t.dataset.filter)});
document.querySelector('#closeModal').onclick=()=>modal.close();document.querySelector('#openPick').onclick=()=>openDetail(stocks[0]);modal.onclick=e=>{if(e.target===modal)modal.close()};render();