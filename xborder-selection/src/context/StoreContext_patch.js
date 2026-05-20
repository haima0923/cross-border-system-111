const fs = require('fs');
let content = fs.readFileSync('StoreContext.tsx', 'utf8');

// 在 useEffect 块后添加30秒轮询逻辑
// 找到现有的 useEffect 块结束位置
const useEffectEnd = content.indexOf('useEffect(() => {');
const useEffectEndMatch = content.indexOf('}, [refetch]);', useEffectEnd);

if (useEffectEndMatch !== -1) {
  const afterUseEffect = content.substring(useEffectEndMatch + '}, [refetch]);'.length);
  
  const pollingCode = `

  // 30秒自动轮询（仅在非loading时触发）
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!loading) {
        refetch();
      }
    }, 30000);
    
    return () => clearInterval(intervalId);
  }, [loading, refetch]);`;
  
  content = content.substring(0, useEffectEndMatch + '}, [refetch]);'.length) + pollingCode + afterUseEffect;
}

fs.writeFileSync('StoreContext.tsx', content);
console.log('StoreContext polling added');
