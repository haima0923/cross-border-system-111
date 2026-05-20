const fs = require('fs');
let content = fs.readFileSync('Workbench.tsx', 'utf8');

// 1. 在 groupLastViewed 后面添加产品级未读状态
const marker1 = 'const markGroupViewed = (groupId: string) => {';
const insertCode1 = `
// 产品级未读标识
  const productViewedKey = (productId: string) => 'wb_pv_' + currentUser.id + '_' + productId;
  const [productLastViewed, setProductLastViewed] = useState<Record<string, string | null>>(() => {
    const init: Record<string, string | null> = {};
    products.forEach(p => { init[p.id] = localStorage.getItem(productViewedKey(p.id)); });
    return init;
  });
  const markProductViewed = (productId: string) => {
    const now = new Date().toISOString();
    localStorage.setItem(productViewedKey(productId), now);
    setProductLastViewed(prev => ({ ...prev, [productId]: now }));
  };
  const isProductUnread = (product: any) => {
    const viewed = productLastViewed[product.id];
    if (!viewed) return true;
    return product.updatedAt > viewed;
  };
`;

if (content.includes(marker1)) {
  content = content.replace(marker1, insertCode1 + marker1);
  console.log('Product unread state added');
}

fs.writeFileSync('Workbench.tsx', content);
console.log('Part 1 done');
