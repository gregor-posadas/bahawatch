"""Tiny stand-ins for the national files, written into a temp folder by the tests."""
import os

OSM = """<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="bahawatch-test">
 <node id="1" lat="14.650" lon="121.060" version="1"/>
 <node id="2" lat="14.650" lon="121.070" version="1"/>
 <node id="3" lat="14.660" lon="121.070" version="1"/>
 <node id="4" lat="14.660" lon="121.060" version="1"/>
 <node id="5" lat="14.655" lon="121.050" version="1"/>
 <node id="6" lat="14.655" lon="121.080" version="1"/>
 <node id="7" lat="14.640" lon="121.065" version="1"/>
 <node id="8" lat="14.670" lon="121.065" version="1"/>
 <node id="9" lat="10.300" lon="123.900" version="1"><tag k="amenity" v="college"/><tag k="name" v="Mandaue City College"/></node>
 <node id="11" lat="10.301" lon="123.901" version="1"/>
 <node id="12" lat="10.302" lon="123.902" version="1"/>
 <way id="10" version="1"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/>
  <tag k="amenity" v="university"/><tag k="name" v="University of the Philippines Diliman"/></way>
 <way id="20" version="1"><nd ref="5"/><nd ref="6"/><tag k="highway" v="primary"/><tag k="name" v="C.P. Garcia Avenue"/><tag k="surface" v="asphalt"/></way>
 <way id="21" version="1"><nd ref="7"/><nd ref="8"/><tag k="waterway" v="stream"/><tag k="name" v="Pansol Creek"/></way>
 <way id="22" version="1"><nd ref="7"/><nd ref="8"/><tag k="highway" v="motorway"/></way>
 <way id="23" version="1"><nd ref="11"/><nd ref="12"/><tag k="highway" v="residential"/></way>
</osm>
"""

def write_osm(path):
    with open(path, "w", encoding="utf-8") as f:
        f.write(OSM)
    return path
