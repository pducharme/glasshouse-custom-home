/* Real Home handlers, synthetic catalogues and no browser/TV/network dependencies. */
'use strict';
var assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
var html = fs.readFileSync(path.join(__dirname, '../server/assets/home.html'), 'utf8');
var script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
script = script.slice(0, script.indexOf("  window.addEventListener('resize'")) +
  'postJson = function (url, body, cb) { send(url, body, cb); };' +
  'getJson = function (url, cb) { read(url, cb); };' +
  'render = applyFocus = renderNow = refreshPicture = refreshGuide = updateWall = beat = applyColours = function () {};' +
  'refreshNow = function (cb) { if (cb) cb(); };' +
  'this.view = { setup: function (d,l) { data=d; layout=l; }, layout: function () { return layout; },' +
  'state:state, settings:homeSettings, open:openHomeSettings, close:closeHomeSettings,' +
  'down:onKeyDown, up:onKeyUp, click:onClick, load:load, returned:returned, toggle:toggleRecommended,' +
  'cards:recCards, markup:recommendationMarkup, openCards:openRecommendations, closeCards:closeRecommendations,' +
  'expanded:function(){return recExpanded;}, select:function(index){state.row=0;state.col.app=index;state.zone="rows";followApps();}' +
  '}; })();';
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function fixture() {
  var apps = [{id:'org.example.video',title:'Vidéos démo'}, {id:'org.example.empty',title:'App sans cartes'},
    {id:'com.tvweb.dashboard',title:'Glasshouse'}];
  var cards = [{id:'demo-card',app:'org.example.video',title:'Titre <inventé>',category:'Démonstration',image:'/demo/poster.svg'}];
  var layout = {rows:['app','rec','dev'],recommended:true,order:{app:apps.map(function(a){return a.id;}),rec:['demo-card'],dev:[],ch:[]},
    sort:{app:'custom',rec:'custom',dev:'custom',ch:'custom'},hidden:{app:[],rec:[],dev:[],ch:[]},folder:[],channels:[],
    photosAppId:'org.example.photo',hintSeen:true,searchHintSeen:true,search:false};
  return {apps:apps,devices:[],channels:[],recommended:cards,order:layout.order,layout:layout,
    layoutVersion:'1',sources:{channels:0},wallpapers:{available:false},photos:{appId:'org.example.photo',installed:false}};
}
function harness() {
  var elements={},posts=[],reads=[],timer=0;
  var document = {documentElement:{lang:'fr-CA'},activeElement:null,hidden:false,
    querySelector:function(){return null;},querySelectorAll:function(){return [];}};
  function element(id) {
    if(!elements[id]) elements[id]={id:id,className:'',textContent:'',innerHTML:'',style:{},attrs:{},
      setAttribute:function(k,v){this.attrs[k]=v;},getAttribute:function(k){return this.attrs[k];},
      focus:function(){document.activeElement=this;},blur:function(){document.activeElement=null;},
      querySelector:function(){return null;},querySelectorAll:function(){return [];}};
    return elements[id];
  }
  document.getElementById=element;document.body=element('body');
  var ctx={Date:Date,Intl:Intl,document:document,window:{},location:{search:''},
    setTimeout:function(){return ++timer;},clearTimeout:function(){},
    t:function(key,text,vars){return text.replace(/\{(\w+)\}/g,function(all,key){return vars&&vars[key]!==undefined?vars[key]:all;});},
    send:function(url,body,cb){posts.push({url:url,body:copy(body),cb:cb});},
    read:function(url,cb){reads.push({url:url,cb:cb});}};
  vm.runInNewContext(script,ctx);
  var view=ctx.view,data=fixture();view.setup(copy(data),copy(data.layout));view.select(0);
  function event(key,shift){return {keyCode:key,shiftKey:!!shift,preventDefault:function(){}};}
  return {view:view,posts:posts,reads:reads,element:element,document:document,data:data,
    down:function(key,shift){view.down(event(key,shift));},up:function(key){view.up(event(key));},
    tap:function(key,shift){view.down(event(key,shift));view.up(event(key));},
    click:function(id){view.click({target:element(id)});}};
}
var h=harness();h.view.open();
assert.strictEqual(h.element('homeSettings').attrs['aria-hidden'],'false');
assert.strictEqual(h.element('recommendedToggle').attrs['aria-checked'],'true','reflect an already-enabled preference');
assert.strictEqual(h.document.activeElement.id,'recommendedToggle');
h.tap(9);assert.strictEqual(h.document.activeElement.id,'homeSettingsClose');
h.tap(9);assert.strictEqual(h.document.activeElement.id,'homeSettingsLaunch');
h.tap(9);assert.strictEqual(h.document.activeElement.id,'recommendedToggle');
h.tap(9,true);assert.strictEqual(h.document.activeElement.id,'homeSettingsLaunch');
h.tap(37);assert.strictEqual(h.document.activeElement.id,'homeSettingsClose');
h.tap(39);assert.strictEqual(h.document.activeElement.id,'homeSettingsLaunch');
h.tap(38);assert.strictEqual(h.document.activeElement.id,'recommendedToggle');
assert.strictEqual(h.posts.length,0,'navigation never writes preferences or launches');

// Preserve unrelated settings and reject a catalogue read started before the toggle.
h.view.load();var stale=h.reads.shift();var before=copy(h.view.layout());h.tap(13);
assert.deepStrictEqual(h.posts[0].body,{recommended:false});
h.tap(13);assert.strictEqual(h.posts.length,1,'pending toggle has one write');
var older=fixture();older.layout.photosAppId='org.example.stale';stale.cb(older);
assert.strictEqual(h.view.layout().photosAppId,before.photosAppId,'stale catalogue cannot overwrite a pending save');
var after=copy(before);after.recommended=false;h.posts[0].cb({ok:true,layout:after});
assert.strictEqual(h.element('recommendedToggle').attrs['aria-checked'],'false');
assert.deepStrictEqual(copy(h.view.layout()),after,'accept server reply without reconstructing or dropping unrelated fields');
var fresh=fixture();fresh.layout=after;fresh.recommended=[];h.reads.shift().cb(fresh);
h.tap(13);h.posts[1].cb({ok:false});
assert.strictEqual(h.element('recommendedToggle').attrs['aria-checked'],'false','failure does not optimistically flip preference');
assert.ok(/non confirmé/.test(h.element('homeSettingsStatus').textContent));

h=harness();h.view.open();h.tap(40);h.tap(39);h.down(13);h.down(13);h.up(13);
assert.strictEqual(h.posts.length,1,'held OK sends one native launch');
assert.deepStrictEqual(h.posts[0].body,{kind:'app',id:'com.tvweb.dashboard'});
h.click('homeSettingsLaunch');h.click('recommendedToggle');
assert.strictEqual(h.posts.length,1,'pending launch blocks duplicates and preference edits');
h.posts[0].cb({ok:false});
assert.strictEqual(h.view.settings.open,true);assert.ok(/pas confirmé/.test(h.element('homeSettingsStatus').textContent));
h.down(32);h.down(32);h.up(32);assert.strictEqual(h.posts.length,2,'Space shares the repeat guard');
h.posts[1].cb({ok:true});assert.strictEqual(h.view.settings.open,false);
assert.strictEqual(h.document.activeElement.id,'homeSettingsTrigger');
h.view.open();h.tap(40);h.tap(39);h.tap(461);assert.strictEqual(h.posts.length,2,'Back before launch never opens an app');
h.view.open();h.tap(40);h.down(13);h.down(13);h.up(13);assert.strictEqual(h.view.settings.open,false,'held OK on Close cannot reopen settings');

// A native launch may take the key-up event away from Home. Its next OK must work.
h=harness();h.view.open();h.tap(40);h.tap(39);h.down(13);
assert.strictEqual(h.view.settings.okDown,true);
h.posts[0].cb({ok:true});
h.view.returned();
assert.strictEqual(h.view.settings.okDown,false,'return clears an OK whose release happened in another app');
h.tap(13);
assert.strictEqual(h.posts.length,2,'first OK after returning launches the selected app');
assert.deepStrictEqual(h.posts[1].body,{kind:'app',id:'org.example.video'});

// Recommendations follow the exact app selected now, never another app's cards.
h=harness();assert.strictEqual(h.view.cards().length,1);
assert.strictEqual(h.view.expanded(),false);
var folded=h.view.markup(1,h.view.cards());assert.ok(/aria-expanded="false"/.test(folded));assert.ok(!/demo\/poster/.test(folded),'folded row contains no remote image request');
h.view.openCards();assert.strictEqual(h.view.expanded(),true);
var expanded=h.view.markup(1,h.view.cards());assert.ok(/Titre &lt;inventé&gt;/.test(expanded));assert.ok(/Vidéos démo/.test(expanded));
h.view.closeCards();assert.strictEqual(h.view.expanded(),false);
h.view.load();var pending=h.reads.shift();h.view.select(1);
assert.strictEqual(h.view.cards().length,0,'empty app never inherits another source');
pending.cb(fixture());assert.strictEqual(h.view.cards().length,0,'late catalogue is filtered against current selection');
var absent=h.view.markup(1,h.view.cards());assert.ok(/data-empty="1"/.test(absent));assert.ok(!/class="tile rec"/.test(absent));
h.view.select(0);assert.strictEqual(h.view.cards().length,1);
var off=copy(h.data.layout);off.recommended=false;h.view.setup(copy(h.data),off);assert.strictEqual(h.view.cards().length,0,'off suppresses even previously loaded cards');
assert.ok(/#stage:not\(\.arranging\) #rows \.recommendation-row\.empty\{display:block;visibility:hidden\}/.test(html),'empty folded row reserves its space without visible content');
assert.ok(/id="homeSettingsLaunch"[^>]*aria-label="Ouvrir Glasshouse"/.test(html));
assert.ok(/src="\/assets\/favicon.svg"/.test(html),'native dashboard shortcut uses the bundled official icon');
assert.ok(!/home-logos|data:image\/svg\+xml;base64/.test(html),'public Home does not embed private app logos');
console.log('Home settings, native shortcut, strict recommendations and stale-response tests passed.');
