// Run with playwright-cli run-code --filename against an isolated preview profile.
async (page) => {
 await page.reload();await page.setViewportSize({width:390,height:844});
 const settled=()=>page.waitForFunction(()=>!/(?:forward|backward)-(?:in|out)/.test(document.querySelector('main')?.className??''));
 const pager=page.getByRole('navigation',{name:'手账翻页'});
 await pager.getByRole('button',{name:'下一页',exact:true}).click();
 const animation=await page.locator('main').evaluate(el=>el.className.includes('forward'));
 await page.getByRole('heading',{name:/^灵感小罐/}).waitFor();await settled();
 await pager.getByRole('button',{name:'下一页',exact:true}).click();
 await page.getByRole('heading',{name:'给盘成勤的一封小笺',exact:true}).waitFor();await settled();
 await pager.getByRole('button',{name:'上一页',exact:true}).click();await settled();
 await pager.getByRole('button',{name:'上一页',exact:true}).click();await settled();
 await page.getByRole('button',{name:'新建手作',exact:true}).click();
 await page.getByRole('textbox',{name:'作品的名字',exact:true}).fill('翻页手账测试');
 await page.getByRole('button',{name:'开始记录',exact:true}).click();await settled();
 for(const text of ['第一页：裁好布料','第二页：缝合边缘','第三页：完成收尾']){
  await page.getByRole('button',{name:'记录新进展',exact:true}).click();
  await page.getByRole('textbox',{name:'今天做了什么'}).fill(text);
  if(text.startsWith('第一页'))await page.locator('input[type=file][multiple]').setInputFiles('dist/icon-192.png');
  await page.getByRole('button',{name:'保存这段过程',exact:true}).click();await settled();
  await page.getByText(text,{exact:true}).waitFor();
 }
 if(!(await pager.getByRole('button',{name:'下一页',exact:true}).isDisabled()))throw Error('Last page should have a boundary');
 await pager.getByRole('button',{name:'上一页',exact:true}).click();await settled();
 await page.getByText('第二页：缝合边缘',{exact:true}).waitFor();
 if(await page.getByText('第三页：完成收尾',{exact:true}).count())throw Error('Multiple diary pages were shown together');
 await pager.getByRole('button',{name:'上一页',exact:true}).click();await settled();
 await page.getByRole('img',{name:'第1条手作记录的照片 1',exact:true}).waitFor();
 await page.locator('main').evaluate(el=>{
  const point=(x)=>new Touch({identifier:1,target:el,clientX:x,clientY:350});
  el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[point(280)]}));
  el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,changedTouches:[point(80)],touches:[]}));
 });
 await settled();await page.getByText('第二页：缝合边缘',{exact:true}).waitFor();
 const layouts=[];
 for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});const value=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));if(value.scrollWidth>value.width)throw Error('Overflow at '+width);layouts.push(value);}
 await page.setViewportSize({width:390,height:844});
 return {pageTurnAnimation:animation,sections:'forward and backward',entryPages:3,swipe:'passed',photo:'preserved',layouts};
}
