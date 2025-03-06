function displayAsHex(number){
  if(number == 0) return "0";
  let str = "";
  let chars = ['a','b','c','d','e','f'];
  while(number != 0){
    let hex_digit = number & 15;
    str = (hex_digit < 10 ? hex_digit : chars[hex_digit - 10]) + str;
    number = number >> 4;
  }
  return str;
}