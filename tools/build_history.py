"""Build the Flood history page (#history) for template.html: a photo essay of Philippine floods, living with water,
and the politics of flood control (Gregor, 2026-10-01). Photos: Wikimedia Commons, licences confirmed on each file
page on 2026-10-01 (credits in shared/gallery/credits.json). Facts: each linked to its source in place.

Run: python3 tools/build_history.py  -> writes partials/history.html (inserted into template.html between the
<!--HISTORY--> markers by the same script).
"""
import html, json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
E = html.escape

def src(href, label, text):
    """A cited phrase: links straight to the source; hover/focus names it; screen readers hear it."""
    return (f'<a class="src" href="{E(href)}" data-src="{E(label)}">{text}'
            f'<span class="sr-only"> (source: {E(label)})</span></a>')

CC = {"CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
      "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
      "CC0": "https://creativecommons.org/publicdomain/zero/1.0/"}

# every photo: file stem, size, alt (what is visible), caption (from the Commons description; nothing added),
# credit as Commons gives it, licence, Commons file page
P = {
 "ondoy-cart": dict(f="2009-ondoy-cart", w=1024, h=682,
   alt="Two men push a wooden handcart through brown floodwater along a city street; more people wade behind them.",
   cap="Metro Manila, 8 October 2009. Floodwater from Ondoy had still not drained nearly two weeks after the storm.",
   by="AusAID (Department of Foreign Affairs and Trade, Australia)", lic="CC BY 2.0",
   page="https://commons.wikimedia.org/wiki/File:Flooding_from_Typhoon_Ondoy_(Ketsana),_Philippines_2009._Photo-_AusAID_(10695910543).jpg"),
 "ondoy-boat": dict(f="2009-ondoy-pasig-boat", w=1024, h=682,
   alt="A wooden boat loaded with sacks of vegetables and passengers moves along a flooded street past a shop sign reading Bangko Pasig.",
   cap="Pasig, 8 October 2009. A boat carries people and produce along a street that was still under water.",
   by="AusAID (Department of Foreign Affairs and Trade, Australia)", lic="CC BY 2.0",
   page="https://commons.wikimedia.org/wiki/File:Flooding_from_Typhoon_Ondoy_(Ketsana),_Philippines_2009._Photo-_AusAID_(10695893643).jpg"),
 "sendong": dict(f="2011-sendong-memorial-wall", w=1024, h=768,
   alt="A stone memorial wall in a park, engraved with rows of names under the words Memorial Wall.",
   cap="Gaston Park, Cagayan de Oro, 2016. The memorial wall lists the names of those who died in the Sendong flood of 17 December 2011.",
   by="Shywise", lic="CC BY-SA 4.0",
   page="https://commons.wikimedia.org/wiki/File:Sendong_Memorial_Tombstone_at_Gaston_Park,_Cagayan_de_Oro_City.jpg"),
 "habagat-family": dict(f="2012-habagat-manila-family", w=1024, h=686,
   alt="A man carries a basin of belongings on his shoulder through floodwater, followed by a woman and a boy; others float on rafts behind.",
   cap="Manila, 8 August 2012. Residents carry what they can through the monsoon flood.",
   by="AusAID (Department of Foreign Affairs and Trade, Australia)", lic="CC BY 2.0",
   page="https://commons.wikimedia.org/wiki/File:Flood_damage_in_Manila,_Philippines_2012._Photo-_AusAID_(10695737533).jpg"),
 "habagat-raft": dict(f="2012-habagat-manila-raft", w=1024, h=686,
   alt="Men push a makeshift raft on an inner tube through a flooded street lined with shops.",
   cap="Manila, 8 August 2012. A raft made from an inner tube moves people and goods.",
   by="AusAID (Department of Foreign Affairs and Trade, Australia)", lic="CC BY 2.0",
   page="https://commons.wikimedia.org/wiki/File:Flood_damage_in_Manila,_Philippines_2012._Photo-_AusAID_(10695722693).jpg"),
 "yolanda-house": dict(f="2013-yolanda-tacloban-house", w=1024, h=682,
   alt="People pick through the wreckage of a destroyed house among broken palm trees on the outskirts of Tacloban.",
   cap="Outskirts of Tacloban, Leyte, 13 November 2013, five days after Yolanda.",
   by="Trócaire", lic="CC BY 2.0",
   page="https://commons.wikimedia.org/wiki/File:Tacloban_Typhoon_Haiyan_2013-11-13.jpg"),
 "yolanda-teacher": dict(f="2013-yolanda-tacloban-teacher", w=1024, h=682,
   alt="Portrait of a teacher in a light blue shirt standing in a damaged street.",
   cap="Tacloban, 24 November 2013. A teacher DFID calls Jolita rescued some of her pupils when a 3-metre storm surge flooded the school where they were sheltering, close to Tacloban’s port. “We had to run for our lives,” she told DFID.",
   by="DFID – UK Department for International Development", lic="CC BY 2.0",
   page="https://commons.wikimedia.org/wiki/File:The_school_was_flooded_with_a_wall_of_water._We_had_to_run_for_our_lives_(11042356445).jpg"),
 "tacloban-court": dict(f="2014-tacloban-basketball", w=1024, h=768,
   alt="Boys play basketball on a cleared court, with storm debris and damaged buildings behind them.",
   cap="Tacloban, 3 May 2014. Six months on, a basketball court cleared of rubble.",
   by="DFID – UK Department for International Development", lic="CC BY 2.0",
   page="https://commons.wikimedia.org/wiki/File:A_reclaimed_basketball_court_in_Tacloban,_six_months_on_from_Typhoon_Haiyan_(14106872866).jpg"),
 "ulysses": dict(f="2020-ulysses-calumpit", w=1024, h=768,
   alt="A man stands knee-deep in floodwater beside narrow wooden boats; another person wades nearby among banana trees.",
   cap="Calumpit, Bulacan, 13 November 2020, the day after Ulysses.",
   by="Judgefloro", lic="CC0",
   page="https://commons.wikimedia.org/wiki/File:1147Effects_(floods)_of_Typhoon_Vamco_(2020)_in_Calumpit,_Bulacan_01.jpg"),
 "carina": dict(f="2024-carina-quiapo", w=1024, h=768,
   alt="People with umbrellas wade through knee-deep floodwater along a street in Quiapo, Manila.",
   cap="Quiapo, Manila, 24 July 2024. Knee-deep floodwater from the monsoon rain that Carina drew in.",
   by="Michael Peronce", lic="CC BY-SA 4.0",
   page="https://commons.wikimedia.org/wiki/File:Quiapo,_Manila_Floods_Habagat-Carina_2024-1.jpg"),
 "kristine": dict(f="2024-kristine-naga", w=1024, h=768,
   alt="Aerial view of rice fields under brown floodwater stretching to the horizon, crossed by a raised road.",
   cap="Naga, Camarines Sur, 23 October 2024. Rice fields under water after Kristine.",
   by="Naga City Government", lic="PD",
   page="https://commons.wikimedia.org/wiki/File:Rice_fields_submerged_in_flooding_in_Naga,_Camarines_Sur.jpg"),
 "tino": dict(f="2025-tino-talisay", w=1024, h=768,
   alt="The swollen brown Mananga River beside a bank of destroyed houses and debris, with people among the wreckage.",
   cap="Talisay, Cebu, 4 November 2025. The Mananga River swells as Tino batters Cebu.",
   by="LadyPinayForever", lic="CC0",
   page="https://commons.wikimedia.org/wiki/File:Mananga_River_in_Talisay_01.jpg"),
 "macabebe": dict(f="2020-macabebe-tidal", w=1024, h=768,
   alt="Floodwater stands around concrete-block houses with laundry hanging out; a child stands in the water.",
   cap="San Francisco, Macabebe, Pampanga, 6 November 2020. Tidal flooding.",
   by="Judgefloro", lic="CC0",
   page="https://commons.wikimedia.org/wiki/File:705Tidal_flooding_in_San_Francisco,_Macabebe,_Pampanga_07.jpg"),
 "hagonoy": dict(f="2020-hagonoy-church", w=1024, h=768,
   alt="A stone church whose doorway stands in floodwater.",
   cap="Santa Monica, Hagonoy, Bulacan, 18 November 2020. Standing water at the church door.",
   by="Judgefloro", lic="CC0",
   page="https://commons.wikimedia.org/wiki/File:2984Flooded_Saint_Monica_chapel_of_Santa_Monica,_Hagonoy_11.jpg"),
 "masantol": dict(f="2025-masantol-gauge", w=771, h=1024,
   alt="A utility pole painted as a flood gauge: monitor and prepare at 2 feet, pre-emptive evacuation at 4 feet, forced evacuation above.",
   cap="Masantol, Pampanga, 15 June 2025. A flood gauge painted on a pole tells residents when to prepare and when to leave.",
   by="Ralff Nestor Nacor", lic="CC BY-SA 4.0",
   page="https://commons.wikimedia.org/wiki/File:Flood_Level_Marker_in_Masantol,_Pampanga,_Jun_2025.jpg"),
 "luneta": dict(f="2025-baha-sa-luneta", w=1024, h=766,
   alt="Aerial view of a large crowd filling a road and plaza in Rizal Park, Manila.",
   cap="Rizal Park, Manila, 21 September 2025, 10:45 a.m. The Baha sa Luneta (“Flood at Luneta”) protest from the air.",
   by="Manila Public Information Office", lic="PD",
   page="https://commons.wikimedia.org/wiki/File:Baha_sa_Luneta_aerial_view.jpg"),
 "tpm": dict(f="2025-trillion-peso-march", w=1024, h=682,
   alt="A dense crowd fills a road beneath an elevated highway; more people watch from the overpass.",
   cap="Near the EDSA Shrine, Quezon City, 21 September 2025. The Trillion Peso March against corruption in flood-control projects.",
   by="Sean Ronquillo (Ubediplomacy)", lic="CC BY-SA 4.0",
   page="https://commons.wikimedia.org/wiki/File:Trillion_Peso_March_at_EDSA_Shrine_in_September_2025_5.jpg"),
}

def fig(k, wide=False):
    p = P[k]; f = p["f"]
    if p["lic"] == "PD":
        lic = "public domain (Philippine government work)"
    else:
        lic = f'<a href="{CC[p["lic"]]}">{p["lic"]}</a>'
    return (f'<figure class="gl-fig{" gl-wide" if wide else ""}">'
            f'<img src="shared/gallery/{f}-1024.jpg" srcset="shared/gallery/{f}-640.jpg 640w, shared/gallery/{f}-1024.jpg 1024w" '
            f'sizes="(max-width:700px) 100vw, 720px" width="{p["w"]}" height="{p["h"]}" alt="{E(p["alt"])}" loading="lazy" decoding="async">'
            f'<figcaption><span class="gl-cap">{E(p["cap"])}</span>'
            f'<span class="gl-credit">Photo: {E(p["by"])} · {lic} · <a href="{E(p["page"])}">Wikimedia Commons</a></span></figcaption></figure>')

# ---- sources (outlet, title, date) ------------------------------------------------------------------------------
S = dict(
 ormoc=("https://ormoc.gov.ph/pages/history.php", "Ormoc City government, History"),
 ormoc2=("https://newsinfo.inquirer.net/90287/monument-marks-20th-year-of-ormoc-flood", "Inquirer, “Monument marks 20th year of Ormoc flood”, 8 Nov 2011"),
 ondoy=("https://www.rappler.com/environment/disasters/70240-ondoy-records/", "Rappler, “Looking back: the records of Ondoy”"),
 ondoyrain=("https://www.gmanetwork.com/news/topstories/nation/173548/ndcc-puts-ondoy-damage-at-p4-8-b-death-toll-at-277/story/", "GMA News, NDCC update, 1 Oct 2009"),
 sendong=("https://newsinfo.inquirer.net/659878", "Inquirer, “What went before: Tropical Storm Sendong”, 28 Dec 2014"),
 sendong2=("https://th.boell.org/en/2022/10/21/10years-typhoon-sendong", "Heinrich Böll Stiftung, “10 years after Typhoon Sendong”, 21 Oct 2022"),
 hab12=("https://go-api.ifrc.org/publicfile/download?path=/docs/Appeals/12/&name=MDRPH010ea.pdf", "IFRC emergency appeal MDRPH010, citing NDRRMC as of 17 Aug 2012"),
 hab12b=("https://www.sbs.com.au/news/article/philippines-floods-half-of-manila-submerged/i3f2gt9wj", "SBS News / AFP, “Half of Manila submerged”, 8 Aug 2012"),
 yolanda=("https://www.gmanetwork.com/news/topstories/nation/357322/ndrrmc-yolanda-death-toll-hits-6-300-mark-nearly-6-months-after-typhoon/story/", "GMA News, NDRRMC Yolanda toll, 17 Apr 2014"),
 ulysses=("https://www.philstar.com/headlines/2020/12/10/2062853/death-count-ulysses-rises-over-100-damage-now-p20-billion", "Philstar, NDRRMC Ulysses toll, 10 Dec 2020"),
 ulysses2=("https://www.philstar.com/headlines/2020/11/12/2056420/marikina-mayor-air-rescue-needed-ulysses-flood-thousands-homes", "Philstar, Marikina floods, 12 Nov 2020"),
 ulysses3=("https://www.philstar.com/headlines/2020/11/15/2056986/massive-flooding-sinks-cagayan", "Philstar, “Massive flooding sinks Cagayan”, 15 Nov 2020"),
 carina=("https://newsinfo.inquirer.net/1969273/carina-habagat-butchoy-killed-46-displaced-over-6-million-says-ndrrmc", "Inquirer, NDRRMC toll for Carina, the habagat (monsoon) and Butchoy, 4 Aug 2024"),
 carina2=("https://newsinfo.inquirer.net/1965260/carina-floods-leave-ph-capital-in-state-of-calamity", "Inquirer, “Carina floods leave PH capital in state of calamity”, 25 Jul 2024"),
 kristine=("https://www.gmanetwork.com/news/topstories/nation/925388/dead-missing-kristine-leon-ndrmmc/story/", "GMA News, NDRRMC toll for Kristine and Leon, 30 Oct 2024"),
 kristine3=("https://tribune.net.ph/2024/10/22/worst-flooding-in-30-years-residents-seek-help-as-kristine-submerges-bicol", "Daily Tribune, 23 Oct 2024"),
 kristine2=("https://www.philstar.com/headlines/2024/10/26/2395431/landslide-buries-village-batangas-14-dead-kristine-death-toll-surges-46", "Philstar, Kristine landslide and floods, 26 Oct 2024"),
 tino=("https://www.gmanetwork.com/news/topstories/nation/966407/269-dead-523-injured-due-to-typhoon-tino-ocd/story/", "GMA News, “269 dead, 523 injured due to Typhoon Tino — OCD”, 17 Nov 2025"),
 tino2=("https://newsinfo.inquirer.net/2134290/tino-floods-leave-cars-in-piles-trap-families-on-rooftops", "Inquirer, “Tino floods leave cars in piles, trap families on rooftops”, 5 Nov 2025"),
 y2026=("https://www.philstar.com/headlines/2026/08/31/2553092/cyclones-habagat-toll-climbs-33-dead-88-million-affected", "Philstar, NDRRMC toll for the 2026 habagat (monsoon) and cyclones, 31 Aug 2026"),
 eco=("https://www.jscimedcentral.com/jounal-article-info/JSM-Environmental-Science-and-Ecology/Disaster-in-Slow-Motion:--Widespread-Land-Subsidence--in-and-Around-Metro-Manila,--Philippines-Quantified-By-Insar--Time-Series-Analysis-9490", "Eco, Rodolfo, Sulapas et al., “Disaster in slow motion”, JSM Environmental Science & Ecology, 2020"),
 rod=("https://research.fit.edu/media/site-specific/researchfitedu/coast-climate-adaptation-library/asia-amp-indian-ocean/southeast-asia-amp-philippines/Rodolfo--Siringan.--2006.--Global-SLR--Flooding-in-the-Northern-Philippines.pdf", "Rodolfo and Siringan, Disasters, 2006"),
 upri=("https://resilience.up.edu.ph/documenting-land-subsidence-in-macabebe-and-obando-upri-noah-hat-and-dr-felix-lills-fieldwork-in-pampanga-and-bulacan/", "UP Resilience Institute, fieldwork in Macabebe and Obando, 2025"),
 pamp=("https://newsinfo.inquirer.net/2117603/pampanga-folk-break-silence-after-years-of-flooding", "Inquirer, “Pampanga folk break silence after years of flooding”, 1 Oct 2025"),
 drain=("https://newsinfo.inquirer.net/1965260/carina-floods-leave-ph-capital-in-state-of-calamity", "Inquirer, 25 Jul 2024"),
 # politics
 sona=("https://www.philstar.com/headlines/2025/07/28/2461416/mahiya-naman-kayo-marcos-vows-raps-vs-execs-tagged-failed-flood-projects", "Philstar, 28 Jul 2025"),
 sona2=("https://newsinfo.inquirer.net/2088472/sona-2025-marcos-on-corrupt-people-in-flood-control-deals-shame-on-you", "Inquirer, 28 Jul 2025"),
 sumbong=("https://newsinfo.inquirer.net/2094047/fwd-marcos-on-flood-control-projects", "Inquirer, 11 Aug 2025"),
 scale=("https://www.gmanetwork.com/news/topstories/specialreports/967723/the-corruption-of-philippine-flood-control-projects/story/", "GMA News special report, “The corruption of Philippine flood control projects”"),
 bonoan=("https://www.philstar.com/headlines/2025/08/31/2469455/marcos-appoints-dizon-new-dpwh-chief-accepts-bonoans-resignation", "Philstar, 31 Aug 2025"),
 discaya=("https://www.gmanetwork.com/news/topstories/nation/958418/romualdez-house-members-deny-links-to-flood-control-kickbacks/story/", "GMA News, 8 Sep 2025"),
 senate=("https://www.philstar.com/headlines/2025/09/09/2471496/senate-dumps-escudero", "Philstar, 9 Sep 2025"),
 house=("https://www.philstar.com/headlines/2025/09/17/2473525/bojie-dy-takes-over-house-speaker-replaces-romualdez", "Philstar, 17 Sep 2025"),
 ici=("https://www.gmanetwork.com/news/topstories/nation/959037/independent-commission-for-infrastructure-members-flood-control-projects-singson-fajardo-magalong/story/", "GMA News, 13 Sep 2025"),
 ici2=("https://newsinfo.inquirer.net/2108046/independent-probe-spans-p-noy-duterte-marcos-years", "Inquirer, 12 Sep 2025"),
 sunstar=("https://www.sunstar.com.ph/manila/timeline-the-flood-control-scandal", "SunStar, “Timeline: the flood control scandal”, 29 Oct 2025"),
 plea=("https://philstarlife.com/news-and-views/831744-not-guilty-plea-entered-for-bong-revilla-malversation-case-ghost-flood-control-project", "PhilSTAR Life, Revilla plea"),
 rally=("https://www.gmanetwork.com/news/topstories/nation/959856/september-21-rallies-anti-corruption-flood-control-projects/story/", "GMA News, 21 Sep 2025"),
 rally2=("https://www.philstar.com/headlines/2025/09/22/2474629/what-we-know-so-far-sept-21-mendiola-recto-riots", "Philstar, 22 Sep 2025"),
 cebu=("https://www.gmanetwork.com/regionaltv/news/111208/pbbm-orders-probe-on-cebu-flood-control-projects-amid-heavy-floods-from-tinoph/story/", "GMA Regional TV, 6 Nov 2025"),
 first=("https://newsinfo.inquirer.net/2144236/warrant-of-arrest-vs-co-17-others", "Inquirer, Nov 2025"),
 nov30=("https://www.philstar.com/headlines/2025/12/01/2491140/pnp-90000-joined-nov-30-anti-corruption-rallies-nationwide", "Philstar, 1 Dec 2025"),
 revilla=("https://www.philstar.com/headlines/2026/01/19/2502221/bong-revilla-surrenders-camp-crame-after-arrest-warrant", "Philstar, 19 Jan 2026"),
 icirep=("https://www.philstar.com/headlines/2026/02/06/2506222/125-day-report-submitted-marcos-decide-icis-fate-soon", "Philstar, 6 Feb 2026"),
 icidoj=("https://mb.com.ph/2026/03/23/ici-turns-over-to-doj-findings-on-anomalous-flood-control-projects", "Manila Bulletin, 23 Mar 2026"),
 estrada=("https://www.sunstar.com.ph/manila/jinggoy-estrada-surrenders-after-plunder-arrest-warrant", "SunStar, 1 Jun 2026"),
 sona26=("https://newsinfo.inquirer.net/2271604/sona-2026-marcos-on-flood-control-mess-p800m-anomalous-assets-returned-to-coffers", "Inquirer, 27 Jul 2026"),
 tally=("https://www.gmanetwork.com/news/topstories/nation/996486/flood-control-projects-contractors-charged/story/", "GMA News, 28 Jul 2026"),
 romu=("https://www.philstar.com/headlines/2026/09/07/2554626/ombudsman-files-plunder-case-vs-romualdez-over-flood-control-scandal", "Philstar, 7 Sep 2026"),
 romu2=("https://www.philstar.com/headlines/2026/09/17/2556885/romualdez-pleads-not-guilty-p74-billion-plunder-case", "Philstar, 17 Sep 2026"),
 romu3=("https://newsinfo.inquirer.net/2312873/romualdez-cites-recantations-as-defense-in-plunder-bail-petition", "Inquirer, 28 Sep 2026"),
 co=("https://globalnation.inquirer.net/320363/govt-fails-to-secure-co-now-says-hes-in-france", "Inquirer, “Gov’t fails to secure Co, now says he’s in France”, 2026"),
 verdict=("https://tribune.net.ph/2026/09/10/decisions-on-flood-control-cases-may-be-out-this-year-sandiganbayan", "Daily Tribune, 10 Sep 2026"),
)
def L(k, text): return src(S[k][0], S[k][1], text)

def event(year, name, body, figs, wide=None):
    """One flood: the story (left on wide screens) and its photos (beside it, side by side when there are several)."""
    txt = f'<div class="gl-txt"><h3><span class="gl-yr">{year}</span> {name}</h3><p>{body}</p></div>'
    ph = ('<div class="gl-figs">' + "".join(fig(k, k == wide) for k in figs) + '</div>') if figs else ''
    return f'<article class="gl-ev{" gl-solo" if not figs else ""}">{txt}{ph}</article>'


FLOODS = [
 event("1991", "Ormoc flash flood (Uring)",
  "Rain from Tropical Storm Uring (Thelma) sent the Ormoc River over its banks on 5 November, carrying logs into the city’s lower districts. "
  "The city government " + L("ormoc", "counts 4,922 dead and 3,000 missing") + "; a later mayor " + L("ormoc2", "put the toll near 8,000") + ". "
  "Illegal logging upstream was widely blamed.", []),
 event("2009", "Ondoy (Ketsana)",
  "On 26 September, " + L("ondoyrain", "341 mm of rain fell on Metro Manila in six hours") + ", more than the city’s previous record for a whole day. "
  "In the worst-hit cities " + L("ondoy", "floodwater reached from knee to neck, up to rooftops") + "; the national disaster council’s final count was "
  + L("ondoy", "464 dead, 37 missing and about 4.9 million people affected") + ".", ["ondoy-cart", "ondoy-boat"]),
 event("2011", "Sendong (Washi)",
  "The storm crossed Cagayan de Oro around midnight on 16–17 December, and the river rose from about 2 m to 10 m, sweeping through riverbank settlements. "
  "Many people drowned in their sleep. " + L("sendong", "1,268 died") + " in Cagayan de Oro, Iligan and nearby provinces; "
  + L("sendong2", "181 bodies were never recovered") + ".", ["sendong"]),
 event("2012", "The habagat (monsoon) floods",
  "Over four days in August the southwest monsoon, strengthened by two typhoons offshore, left " + L("hab12b", "about half of Manila under water") + ". "
  "By 17 August the national disaster council counted " + L("hab12", "109 dead and 4.2 million people affected") + ".",
  ["habagat-family", "habagat-raft"]),
 event("2013", "Yolanda (Haiyan)",
  "On 8 November Yolanda drove a storm surge into Tacloban and the coasts of Eastern Visayas. "
  "Nearly six months later the national disaster council counted " + L("yolanda", "6,300 dead and 1,061 missing") + ".",
  ["yolanda-house", "yolanda-teacher", "tacloban-court"], wide="yolanda-house"),
 event("2020", "Ulysses (Vamco)",
  "In November the Marikina River " + L("ulysses2", "rose to 22.0 m, above Ondoy’s 21.5 m") + ", and in Cagayan families "
  + L("ulysses3", "spent days on their roofs") + ". The national count reached " + L("ulysses", "101 dead and 4.9 million affected") + ".",
  ["ulysses"]),
 event("2024", "Carina (Gaemi) and the habagat (monsoon)",
  "In July rain " + L("carina2", "reached 74 mm an hour, against drains built for about 30") + ", and Metro Manila declared a state of calamity. "
  "The national count: " + L("carina", "46 reported dead, more than 6 million affected") + ".", ["carina"]),
 event("2024", "Kristine (Trami)",
  "In October residents of Bicol " + L("kristine3", "called it the worst flooding in 30 years") + ", and many " + L("kristine2", "waited on rooftops for rescue") + ". "
  "Counted together with Typhoon Leon, which followed, the toll reached " + L("kristine", "145 dead and 37 missing") + " by 30 October.", ["kristine"]),
 event("2025", "Tino (Kalmaegi)",
  "On 4 November floodwater in Cebu " + L("tino2", "trapped families on rooftops") + " in Liloan, Consolacion, Mandaue and Talisay, and piled cars in the streets. "
  "By 17 November the Office of Civil Defense counted " + L("tino", "269 dead and 113 missing nationwide, 150 of the dead in Cebu") + ".", ["tino"], wide="tino"),
 event("2026", "Monsoon and three storms",
  "Through August the habagat (monsoon) and Tropical Cyclones Luis, Maymay and Neneng brought floods and landslides from Baguio to Batangas: "
  + L("y2026", "33 dead and 8.8 million people affected") + " by 31 August, the national disaster council said.", []),
]

WATER = (
 '<div class="gl-split"><div class="gl-txt"><p>For many families, flooding is not an event but a season, or a tide. Much of Metro Manila and the land around northern Manila Bay is sinking, '
 'largely because groundwater is pumped out faster than it returns. Between 2003 and 2011 parts of '
 + L("eco", "Caloocan, Malabon, Navotas and Valenzuela sank by up to 4.2 cm a year") + ', and around northern Manila Bay '
 + L("rod", "several centimetres to more than a decimetre a year") + '. Metro Manila’s drains handle '
 + L("drain", "about 30 mm of rain an hour") + '.</p>'
 '<p>In Macabebe, Pampanga, researchers in 2025 found ' + L("upri", "neighbourhoods permanently under water") + '. '
 '“Since July… the villages haven’t dried,” ' + L("pamp", "a local official told the Inquirer") + ' that October.</p>'
 + '</div><div class="gl-figs">' + fig("macabebe") + fig("hagonoy") + fig("masantol") + '</div></div>'
)

TL = [
 ("28 Jul 2025", "In his State of the Nation Address, President Ferdinand Marcos Jr. condemned failed and “ghost” flood-control projects: "
   "“Mahiya naman kayo” (“Shame on you”). He " + L("sona2", "ordered a list of every flood-control project of the past three years") + " and "
   + L("sona", "promised charges against those found connected") + "."),
 ("11 Aug 2025", "He opened " + L("sumbong", "Sumbong sa Pangulo (“Report to the President”)") + ", a public website mapping the projects, and "
   + L("scale", "said 15 contractors had won more than ₱100 billion of the ₱545 billion in 9,855 projects since July 2022") + "."),
 ("Aug–Sep 2025", "Senate and House hearings followed. Public Works Secretary Manuel Bonoan " + L("bonoan", "resigned; Vince Dizon replaced him") + ". "
   "Contractors Sarah and Curlee Discaya named lawmakers and officials as allegedly involved; "
   + L("discaya", "House Speaker Martin Romualdez and several others named denied it") + "."),
 ("8–17 Sep 2025", "Vicente Sotto III " + L("senate", "replaced Francis Escudero as Senate President") + ", and Mr Romualdez "
   + L("house", "resigned as House Speaker amid the allegations") + ", which he denies; Faustino Dy III succeeded him."),
 ("11–15 Sep 2025", "An executive order " + L("ici2", "created the Independent Commission for Infrastructure") + " to investigate public works of the past ten years, "
   + L("sunstar", "chaired by retired Justice Andres Reyes Jr.") + "."),
 ("21 Sep 2025", "Tens of thousands joined the Baha sa Luneta (“Flood at Luneta”) and Trillion Peso March protests: "
   + L("rally", "at least 50,000 at Luneta by the Manila disaster office’s count, and 60,000 to 70,000 at EDSA by the organisers’") + ". Separate clashes near Mendiola ended in "
   + L("rally2", "216 arrests and more than 100 police and about 70 civilians injured") + "."),
 ("6 Nov 2025", "After Typhoon Tino, the President " + L("cebu", "ordered an investigation of Cebu’s flood-control projects") + "; Cebu’s governor said "
   "the province had received ₱26 billion in flood-control funds “yet we are flooded to the max”."),
 ("Nov 2025", "The first cases reached the anti-graft court, which " + L("first", "ordered the arrest of former Representative Zaldy Co and 15 others")
   + " over a ₱289-million dike in Oriental Mindoro. Mr Co " + L("co", "has remained abroad") + ". On 30 November police counted "
   + L("nov30", "about 90,000 people at 119 rallies nationwide") + "."),
 ("Jan–Jun 2026", "Former Senator Bong Revilla " + L("revilla", "surrendered on a malversation warrant") + ". He has denied involvement; when he "
   + L("plea", "refused to enter a plea, the court entered not guilty for him") + ". Senator Jinggoy Estrada " + L("estrada", "surrendered on a plunder warrant") + " and denies the charges. The commission "
   + L("icirep", "referred 65 people for prosecution and reported ₱24.7 billion in assets frozen, seized or surrendered") + ", then "
   + L("icidoj", "handed its evidence to prosecutors") + "."),
 ("27–28 Jul 2026", "In his next address the President said " + L("sona26", "more than ₱800 million had been returned") + "; GMA News counted "
   + L("tally", "45 people charged in 26 cases") + "."),
 ("Sep 2026", "The Ombudsman " + L("romu", "charged former Speaker Romualdez with plunder") + " over ₱7.44 billion; he denies wrongdoing. He was arrested, "
   + L("romu2", "pleaded not guilty") + " and " + L("romu3", "has asked for bail") + ". The anti-graft court said "
   + L("verdict", "its first decisions may come this year") + "."),
]

def build():
    floods = "\n".join(FLOODS)
    tl = "".join(f'<li><time>{E(d)}</time><p>{t}</p></li>' for d, t in TL)
    tabs = ('<nav class="site-tabs" role="tablist" aria-label="Site">\n'
      + "".join(f'  <button role="tab" data-site="{k}" aria-selected="{"true" if k=="history" else "false"}">{v}</button>\n'
                for k, v in [("home","Home"),("ph","PhilDev campuses"),("tv","Teachers Village"),("sjq","San Joaquin"),("berkeley","UC Berkeley"),
                             ("try","Try reporting"),("history","Flood history"),("about","About"),("access","Accessibility")])
      + '</nav>')
    return f'''<section id="history" aria-labelledby="hi-h">
 <div class="ab-inner">
  <div class="nat-top">
    <img class="hdr-logo" alt="" width="40" height="40">
    <div><div class="p-name">BahaWatch</div><h1 class="nat-h" id="hi-h">Flood history</h1></div>
    <div class="p-tools">
      <button id="hi-theme" aria-label="Switch theme">☾</button>
    </div>
  </div>
{tabs}
  <div class="ab-body">
   <nav class="ab-rail hi-rail" aria-label="On this page">
    <p class="ab-rail-h">On this page</p>
    <ul>
      <li><a href="#history/floods" data-sec="floods">The floods</a></li>
      <li><a href="#history/water" data-sec="water">Living with water</a></li>
      <li><a href="#history/politics" data-sec="politics">The politics of flood control</a></li>
      <li><a href="#history/credits" data-sec="credits">Photo credits</a></li>
    </ul>
   </nav>
   <article class="ab-main gl-main">
    <section id="hi-intro" aria-label="Introduction">
      <p class="ab-lead">Floods are part of life in the Philippines. Behind every number on this dashboard are families who wade to work, carry what they can, and wait on rooftops for rescue. This page remembers some of them.</p>
      <p class="gl-warn">Some photographs show homes destroyed by storms. None show people who died.</p>
    </section>
    <section id="hi-floods" aria-labelledby="hi-floods-h">
      <h2 id="hi-floods-h" tabindex="-1">The floods</h2>
      {floods}
    </section>
    <section id="hi-water" aria-labelledby="hi-water-h">
      <h2 id="hi-water-h" tabindex="-1">Living with water</h2>
      {WATER}
    </section>
    <section id="hi-politics" aria-labelledby="hi-politics-h">
      <h2 id="hi-politics-h" tabindex="-1">The politics of flood control</h2>
      <p>In 2025 flood control became the country’s biggest political story. What follows is what happened and who said what, as reported by news outlets; people charged are presumed innocent until a court decides.</p>
      <div class="gl-split gl-pol"><ol class="gl-time">{tl}</ol><div class="gl-figs gl-sticky">{fig("luneta")}{fig("tpm")}</div></div>
      <p class="gl-asof">As of 1 October 2026 we found no report of a verdict in any of the flood-control cases.</p>
    </section>
    <section id="hi-credits" aria-labelledby="hi-credits-h">
      <h2 id="hi-credits-h" tabindex="-1">Photo credits</h2>
      <p>Every photograph is from Wikimedia Commons under an open licence, credited under the photo with its licence and a link to its page. We resized them for the web and changed nothing else. Photos under CC BY-SA keep that licence. The Philippine government photos are public domain under Section 176 of the Intellectual Property Code.</p>
      <p>Facts and figures link to their sources where they appear. Tolls are the latest official counts we could find and may differ from other reports. Write to Noam (on the <a href="#home/contact">homepage</a>) to correct anything here.</p>
    </section>
   </article>
  </div>
 </div>
</section>'''

if __name__ == "__main__":
    out = build()
    t = (ROOT / "template.html").read_text(encoding="utf-8")
    a, b = "<!--HISTORY-->", "<!--/HISTORY-->"
    i, j = t.index(a), t.index(b)
    t = t[:i + len(a)] + "\n" + out + "\n" + t[j:]
    (ROOT / "template.html").write_text(t, encoding="utf-8")
    print("history page:", len(out), "chars,", out.count("<figure"), "photos,", out.count('class="src"'), "source links")
