export function decimalValue(value){
  if(typeof value!=='string'||!value.includes('/')) return value;
  const [numerator,denominator]=value.split('/').map(Number);
  return denominator?numerator/denominator:value;
}
