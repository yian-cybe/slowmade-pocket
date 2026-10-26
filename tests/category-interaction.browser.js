// Run against the local preview with playwright-cli run-code --filename.
// Native selects can dispatch input and change in separate tasks.
async (page) => {
 await page.reload();
 await page.getByRole('button',{name:'新建手作',exact:true}).click();
 const type=page.getByRole('combobox',{name:'属于哪一类'});
 await type.selectOption('不限类型');
 await type.focus();
 await page.keyboard.press('ArrowDown');
 if(await type.inputValue()!=='编织')throw Error('First native keyboard selection was reset');
 await page.keyboard.press('ArrowDown');
 if(await type.inputValue()!=='布艺')throw Error('Repeated native keyboard selection was reset');
 await type.selectOption('不限类型');
 await type.evaluate(el=>{el.value='布艺';el.dispatchEvent(new Event('input',{bubbles:true}));});
 if(await type.inputValue()!=='布艺')throw Error('Draft saving reset the native select before its change event');
 await type.evaluate(el=>el.dispatchEvent(new Event('change',{bubbles:true})));
 if(await type.inputValue()!=='布艺')throw Error('Native category change was not retained');
 await type.selectOption('__custom_category__');
 await page.getByRole('textbox',{name:'自定义类型名称',exact:true}).fill('皮具');
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.reload();
 await page.getByRole('button',{name:'新建手作',exact:true}).click();
 if(await page.getByRole('textbox',{name:'自定义类型名称',exact:true}).inputValue()!=='皮具')throw Error('Custom category draft was lost');
 return {nativeSelection:'retained',customDraft:'restored'};
}
