const fs = require('fs');
let content = fs.readFileSync('SamplingDetail.tsx', 'utf8');

// 替换运费显示部分
const oldBlock = ;

const newBlock = ;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  console.log('Shipping display updated');
  fs.writeFileSync('SamplingDetail.tsx', content);
} else {
  console.log('Old block not found');
}
