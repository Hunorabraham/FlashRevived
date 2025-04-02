let file_in = document.querySelector("input");
let test_in = document.querySelectorAll("input")[1];
let testBytes = undefined;
file_in.onchange = (e)=>{
    let file = e.target.files[0];
    console.log(file);
    if(!file){
        console.error("What? There is no file?");
        return;
    }
    READER.read(file, testBytes).then((result)=>{
      console.log(result);
      let fp = new FLASH_PLAYER(result, new HTML_CANVAS_RENDERER(document.body));
      fp.run()
      fp.test();
    }).catch((err)=>console.error(err));
    if(file.type != "application/x-shockwave-flash"){
        console.error("WOHA there pal, that is not a shockwafe flash file!");
        return;
    }
}
/*
test_in.onchange = (e)=>{
  let file = e.target.files[0];
  console.log("test file: ", file);
  if(!file) return;
  let fr = new FileReader();
  fr.readAsArrayBuffer(file);
  fr.onload = ()=>{
    testBytes = new Uint8Array(fr.result);
  }
}*/
