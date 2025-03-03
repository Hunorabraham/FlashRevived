class Tag{
  constructor(type, length){
    this.type = type;
    this.length = length;
  }
}
/**
 * I don't want to bother with modules and stuff, confession: I have no clue how to make them work, I tried and failed
*/
class READER{
  static hello(){console.log("hello, testing complete..."); console.error("THERE ARE ALWAYS ERRORS");}
  static read(file){
    let fr = new FileReader();
    fr.readAsArrayBuffer(file);
    return new Promise((resolve, reject)=>{
      fr.onload = ()=>{
        resolve(fr.result);
      }
      fr.onerror = (error)=>{
        reject(error);
      }
    });
  }
}
//STOP, don't implement yet >:(