const fs=require("fs");
const {Document,Packer,Paragraph,TextRun,AlignmentType,TabStopType}=require("docx");
const P=(text,opts={})=>new Paragraph({spacing:{after:opts.after??160,line:276},alignment:opts.align,children:(Array.isArray(text)?text:[text]).map(t=>typeof t==="string"?new TextRun({text:t,font:"Helvetica",size:22,bold:opts.bold}):t)});
const B=t=>new TextRun({text:t,font:"Helvetica",size:22,bold:true});
const R=t=>new TextRun({text:t,font:"Helvetica",size:22});
const blank=()=>new Paragraph({spacing:{after:0}});
const doc=new Document({
  styles:{default:{document:{run:{font:"Helvetica",size:22}}}},
  sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1440,bottom:1440,left:1440,right:1440}}},children:[
    P([B("Gregor Posadas")],{after:0}),
    P("Ph.D. Student, Civil and Environmental Engineering",{after:0}),
    P("University of California, Berkeley",{after:0}),
    P("gregorposadas@berkeley.edu",{after:280}),
    P("[Date]",{after:280}),
    P([B("Dr. Czar Jakiri Sarmiento")],{after:0}),
    P("Director, UP Training Center for Applied Photogrammetry and Geodesy",{after:0}),
    P("312–316 National Engineering Center, Juinio Hall",{after:0}),
    P("University of the Philippines, Diliman, Quezon City",{after:280}),
    P([B("Subject: Request for UP DREAM / PHIL-LiDAR 1 data — Digital Terrain Model and Flood Hazard Maps for Barangay UP Campus and Barangays Teachers Village East and West, Quezon City")],{after:280}),
    P("Dear Dr. Sarmiento,"),
    P("I am writing to request access to UP DREAM / PHIL-LiDAR 1 data for two areas in Quezon City, for use in an academic research prototype at the University of California, Berkeley, under the supervision of Professor Kara Nelson (Civil and Environmental Engineering)."),
    P([B("Project background. "),R("BahaWatch is an open-source flood-sensing project that pairs low-cost ultrasonic water-level sensors, mounted on household gates and reporting over LoRaWAN every ten minutes, with a web dashboard that turns those point readings into street-level flood extents residents can act on. The dashboard infers where water reaches from the sensor readings and the terrain alone, and displays official flood hazard maps alongside as a reference layer. A working prototype for Teachers Village currently runs on the 30 m Copernicus surface model, which limits how faithfully modeled water follows the streets. Partners in the project include Bike Scouts Philippines, the UP Resilience Institute / Project NOAH (Dr. Alfredo Mahar Lagmay), and the UC Berkeley Disaster Lab.")]),
    P([B("Data requested. "),R("(1) PHIL-LiDAR 1 Digital Terrain Model (1 m) and (2) PHIL-LiDAR 1 Flood Hazard Maps, for the two areas of interest in the attached ESRI shapefile: Barangay UP Campus (the UP Diliman campus, approx. 121.056–121.082 E, 14.644–14.670 N) and Barangays Teachers Village East and West and their immediate surroundings (approx. 121.045–121.085 E, 14.618–14.655 N), together about 26 km².")]),
    P([B("Intended use. "),R("The DTM will serve as the terrain surface for the sensor-driven flood-extent model, replacing the 30 m surface model, and the Flood Hazard Maps will replace the coarser Metro Manila hazard layer as the reference overlay. The data will be used for research and demonstration only; it will not be redistributed, and all outputs will acknowledge the UP DREAM / PHIL-LiDAR Program and UP TCAGP as the data source in accordance with your data-use terms.")]),
    P("Thank you for considering this request. I would be glad to provide any further information you need."),
    P("Respectfully,",{after:560}),
    P([B("Gregor Posadas")],{after:0}),
    P("Ph.D. Student, Civil and Environmental Engineering, UC Berkeley",{after:400}),
    P([B("Endorsed by:")],{after:560}),
    P("________________________________",{after:0}),
    P([B("Prof. Kara L. Nelson")],{after:0}),
    P("Professor, Civil and Environmental Engineering",{after:0}),
    P("University of California, Berkeley",{after:0}),
    P("nelson@berkeley.edu",{after:280}),
    P([R("Enclosure: BahaWatch_AOI_shapefile.zip (ESRI shapefile, WGS84, two polygons)")]),
  ]}]});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync("/mnt/user-data/outputs/LiPAD_Data_Request_Letter.docx",b);console.log("written");});
