let file_in = document.querySelector("input");
file_in.onchange = (e)=>{
  let file = e.target.files[0];
  if(!file){
      console.error("What? There is no file?");
      return;
  }
  if(file.type != "application/x-shockwave-flash"){
      console.error("WOHA there pal, that is not a shockwafe flash file!");
      return;
  }
  READER.read(file).then((data)=>{
      console.log(data);
  }).catch((err)=>{
      console.error(err);
  });
}