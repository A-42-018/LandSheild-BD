/** Static geo list (all 64 districts and their upazilas/thanas). `value` is the English name sent to the API; labels are display-only. */
export interface GeoOption {
  value: string;
  en: string;
  bn: string;
}
export interface District extends GeoOption {
  /** English name of the parent division (UI filter only; the API still receives the district). */
  division: string;
  upazilas: GeoOption[];
}

const g = (en: string, bn: string): GeoOption => ({ value: en, en, bn });

export const DISTRICTS: District[] = [
  {
    ...g("Bagerhat", "বাগেরহাট"),
    division: "Khulna",
    upazilas: [g("Bagerhat Sadar", "বাগেরহাট সদর"), g("Chitalmari", "চিতলমাড়ি"), g("Fakirhat", "ফকিরহাট"), g("Kachua", "কচুয়া"), g("Mollahat", "মোল্লাহাট"), g("Mongla", "মংলা"), g("Morrelganj", "মরেলগঞ্জ"), g("Rampal", "রামপাল"), g("Sarankhola", "স্মরণখোলা")],
  },
  {
    ...g("Bandarban", "বান্দরবান"),
    division: "Chattogram",
    upazilas: [g("Ali kadam", "আলী কদম"), g("Bandarban Sadar", "বান্দরবন সদর"), g("Lama", "লামা"), g("Naikhongchhari", "নাইখংছড়ি"), g("Rowangchhari", "রউয়াংছড়ি"), g("Ruma", "রুমা"), g("Thanchi", "থানচি")],
  },
  {
    ...g("Barguna", "বরগুনা"),
    division: "Barishal",
    upazilas: [g("Amtali", "আমতলী"), g("Bamna", "বামনা"), g("Barguna Sadar", "বরগুনা সদর"), g("Betagi", "বেতাগি"), g("Patharghata", "পাথরঘাটা")],
  },
  {
    ...g("Barishal", "বরিশাল"),
    division: "Barishal",
    upazilas: [g("Agailjhara", "আগাইলঝরা"), g("Babuganj", "বাবুগঞ্জ"), g("Bakerganj", "বাকেরগঞ্জ"), g("Banaripara", "বানাড়িপারা"), g("Barisal Sadar", "বরিশাল সদর"), g("Gaurnadi", "গৌরনদী"), g("Hizla", "হিজলা"), g("Mehendiganj", "মেহেদিগঞ্জ"), g("Muladi", "মুলাদি"), g("Wazirpur", "ওয়াজিরপুর")],
  },
  {
    ...g("Bhola", "ভোলা"),
    division: "Barishal",
    upazilas: [g("Bhola Sadar", "ভোলা সদর"), g("Burhanuddin", "বুরহানউদ্দিন"), g("Char Fasson", "চর ফ্যাশন"), g("Daulatkhan", "দৌলতখান"), g("Hatiya", "হাতিয়া"), g("Lalmohan", "লালমোহন"), g("Manpura", "মনপুরা"), g("Tazumuddin", "তাজুমুদ্দিন")],
  },
  {
    ...g("Bogura", "বগুড়া"),
    division: "Rajshahi",
    upazilas: [g("Adamdighi", "আদমদিঘী"), g("Bogra Sadar", "বগুড়া সদর"), g("Dhunat", "ধুনট"), g("Dhupchanchia", "দুপচাচিয়া"), g("Gabtali", "গাবতলি"), g("Kahaloo", "কাহালু"), g("Nandigram", "নন্দিগ্রাম"), g("Sahajanpur", "শাহজাহানপুর"), g("Sariakandi", "সারিয়াকান্দি"), g("Sherpur", "শেরপুর"), g("Shibganj", "শিবগঞ্জ"), g("Sonatala", "সোনাতলা")],
  },
  {
    ...g("Brahmanbaria", "ব্রাহ্মণবাড়িয়া"),
    division: "Chattogram",
    upazilas: [g("Akhaura", "আখাউরা"), g("Ashuganj", "আশুগঞ্জ"), g("Austagram", "অষ্টগ্রাম"), g("Bancharampur", "বাঞ্ছারামপুর"), g("Bijoynagar", "বিজয় নগর"), g("Brahmanbaria Sadar", "ব্রাহ্মণবাড়িয়া সদর"), g("Kasba", "কসবা"), g("Nabinagar", "নবীনগর"), g("Nasirnagar", "নাসির নগর"), g("Roypura", "রায়পুরা"), g("Sarail", "সরাইল")],
  },
  {
    ...g("Chandpur", "চাঁদপুর"),
    division: "Chattogram",
    upazilas: [g("Chandpur Sadar", "চাঁদপুর সদর"), g("Faridganj", "ফরিদগঞ্জ"), g("Haimchar", "হাইমচর"), g("Kachua", "কচুয়া"), g("Matlab Dakkhin", "মতলব দক্ষিণ"), g("Matlab Uttar", "মতলব উত্তর"), g("Shahrasti", "শাহরাস্তি")],
  },
  {
    ...g("Chattogram", "চট্টগ্রাম"),
    division: "Chattogram",
    upazilas: [g("Anwara", "আনোয়ারা"), g("Bakalia", "বাকলিয়া"), g("Banshkhali", "বাশখালি"), g("Bayejid Bostami", "বায়েজিদ বোস্তামী"), g("Boalkhali", "বোয়ালখালি"), g("Chandanaish", "চন্দনাইশ"), g("Chandgaon", "চান্দগাঁও"), g("Chittagong Port", "বন্দর"), g("Double Mooring", "ডাবলমুরিং"), g("Fatikchhari", "ফটিকছড়ি"), g("Halishahar", "হালিশহর"), g("Hathazari", "হাঠহাজারী"), g("Kawkhali (Betbunia)", "কাউখালী (বেতবুনিয়া)"), g("Khulshi", "খুলশী"), g("Kotwali", "কোতোয়ালী"), g("Lohagara", "লোহাগারা"), g("Mirsharai", "মিরসরাই"), g("Pahartali", "পাহাড়তলী"), g("Panchlaish", "পাঁচলাইশ"), g("Patenga", "পতেঙ্গা"), g("Patiya", "পটিয়া"), g("Rangunia", "রাঙ্গুনিয়া"), g("Raozan", "রাউজান"), g("Sandwip", "সন্দ্বীপ"), g("Satkania", "সাতকানিয়া"), g("Sitakunda", "সীতাকুণ্ড"), g("Subarnachar", "সুবর্ণচর")],
  },
  {
    ...g("Chuadanga", "চুয়াডাঙ্গা"),
    division: "Khulna",
    upazilas: [g("Alamdanga", "আলমডাঙ্গা"), g("Chuadanga Sadar", "চুয়াডাঙ্গা সদর"), g("Damurhuda", "দামুরহুদা"), g("Gangni", "গাংনী"), g("Jibannagar", "জীবন নগর"), g("Meherpur Sadar", "মেহেরপুর সদর")],
  },
  {
    ...g("Cox's Bazar", "কক্স বাজার"),
    division: "Chattogram",
    upazilas: [g("Chakaria", "চকরিয়া"), g("Cox's Bazar Sadar", "কক্স বাজার সদর"), g("Kutubdia", "কুতুবদিয়া"), g("Maheshkhali", "মহেশখালী"), g("Pekua", "পেকুয়া"), g("Ramu", "রামু"), g("Teknaf", "টেকনাফ"), g("Ukhia", "উখিয়া")],
  },
  {
    ...g("Cumilla", "কুমিল্লা"),
    division: "Chattogram",
    upazilas: [g("Barura", "বড়ুরা"), g("Brahmanpara", "ব্রাহ্মণপাড়া"), g("Burichong", "বুড়িচং"), g("Chandina", "চান্দিনা"), g("Chauddagram", "চৌদ্দগ্রাম"), g("Comilla Adarsha Sadar", "কুমিল্লা আদর্শ সদর"), g("Comilla Sadar South", "কুমিল্লা সদর দক্ষিণ"), g("Daudkandi", "দাউদকান্দি"), g("Debidwar", "দেবীদ্বার"), g("Homna", "হোমনা"), g("Laksam", "লাকসাম"), g("Meghna", "মেঘনা"), g("Muradnagar", "মুরাদনগর"), g("Nangalkot", "নাঙ্গালকোট"), g("Titas", "তিতাস")],
  },
  {
    ...g("Dhaka", "ঢাকা"),
    division: "Dhaka",
    upazilas: [g("Adabor", "আদাবর"), g("Badda", "বাড্ডা"), g("Bangshal", "বংশাল"), g("Biman Bandar", "বিমানবন্দর"), g("Cantonment", "ক্যান্টনমেন্ট"), g("Chak Bazar", "চকবাজার"), g("Dakshinkhan", "দক্ষিণখান"), g("Darus Salam", "দারুস সালাম"), g("Demra", "ডেমরা"), g("Dhamrai", "ধামরাই"), g("Dhanmondi", "ধানমন্ডি"), g("Dohar", "দোহার"), g("Gendaria", "গেণ্ডারিয়া"), g("Gulshan", "গুলশান"), g("Hazaribagh", "হাজারীবাগ"), g("Jatrabari", "যাত্রাবাড়ী"), g("Kadamtali", "কদমতলী"), g("Kafrul", "কাফরুল"), g("Kalabagan", "কলাবাগান"), g("Kamrangir Char", "কামরাঙ্গীরচর"), g("Keraniganj", "কেরানীগঞ্জ"), g("Khilgaon", "খিলগাঁও"), g("Khilkhet", "খিলক্ষেত"), g("Kotwali", "কোতোয়ালী"), g("Lalbagh", "লালবাগ"), g("Mirpur", "মিরপুর"), g("Mohammadpur", "মোহাম্মদপুর"), g("Motijheel", "মতিঝিল"), g("Nawabganj", "নবাবগঞ্জ"), g("New Market", "নিউ মার্কেট"), g("Pallabi", "পল্লবী"), g("Paltan", "পল্টন"), g("Ramna", "রমনা"), g("Rampura", "রামপুরা"), g("Sabujbagh", "সবুজবাগ"), g("Savar", "সাভার"), g("Shah Ali", "শাহ আলী"), g("Shahbagh", "শাহবাগ"), g("Sher-e-bangla Nagar", "শেরেবাংলা নগর"), g("Shyampur", "শ্যামপুর"), g("Sutrapur", "সূত্রাপুর"), g("Tejgaon", "তেজগাঁও"), g("Tejgaon Ind. Area", "তেজগাঁও শিল্প এলাকা"), g("Turag", "তুরাগ"), g("Uttar Khan", "উত্তরখান"), g("Uttara", "উত্তরা")],
  },
  {
    ...g("Dinajpur", "দিনাজপুর"),
    division: "Rangpur",
    upazilas: [g("Biral", "বিড়াল"), g("Birampur", "বিরামপুর"), g("Birganj", "বীরগঞ্জ"), g("Bochaganj", "বোচাগঞ্জ"), g("Chirirbandar", "চিরিরবন্দর"), g("Dinajpur Sadar", "দিনাজপুর সদর"), g("Ghoraghat", "ঘোড়াঘাট"), g("Hakimpur", "হাকিমপুর"), g("Kaharole", "কাহারোল"), g("Khansama", "খানসামা"), g("Nawabganj", "নবাবগঞ্জ"), g("Parbatipur", "পার্বতীপুর"), g("Phulbari", "ফুলবাড়ি")],
  },
  {
    ...g("Faridpur", "ফরিদপুর"),
    division: "Dhaka",
    upazilas: [g("Alfadanga", "আলফাডাঙ্গা"), g("Bhanga", "ভাঙ্গা"), g("Boalmari", "বোয়ালমারী"), g("Charbhadrasan", "চরভদ্রাসন"), g("Faridpur Sadar", "ফরিদপুর সদর"), g("Madhukhali", "মধুখালি"), g("Nagarkanda", "নগরকান্ড"), g("Sadarpur", "সদরপুর"), g("Shaltha", "শালথা")],
  },
  {
    ...g("Feni", "ফেনী"),
    division: "Chattogram",
    upazilas: [g("Chagalnaiya", "ছাগল নাইয়া"), g("Daganbhyan", "দাগানভিয়া"), g("Feni Sadar", "ফেনী সদর"), g("Fhulgazi", "ফুলগাজি"), g("Parshuram", "পরশুরাম"), g("Sonagazi", "সোনাগাজি")],
  },
  {
    ...g("Gaibandha", "গাইবান্ধা"),
    division: "Rangpur",
    upazilas: [g("Fulchhari", "ফুলছড়ি"), g("Gaibandha sadar", "গাইবান্ধা সদর"), g("Gobindaganj", "গোবিন্দগঞ্জ"), g("Palashbari", "পলাশবাড়ী"), g("Sadullapur", "সাদুল্যাপুর"), g("Saghata", "সাঘাটা"), g("Sundarganj", "সুন্দরগঞ্জ")],
  },
  {
    ...g("Gazipur", "গাজীপুর"),
    division: "Dhaka",
    upazilas: [g("Gazipur Sadar", "গাজীপুর সদর"), g("Kaliakair", "কালিয়াকৈর"), g("Kaliganj", "কালীগঞ্জ"), g("Kapasia", "কাপাসিয়া"), g("Sreepur", "শ্রীপুর")],
  },
  {
    ...g("Gopalganj", "গোপালগঞ্জ"),
    division: "Dhaka",
    upazilas: [g("Gopalganj Sadar", "গোপালগঞ্জ সদর"), g("Kashiani", "কাশিয়ানি"), g("Kotalipara", "কোটালিপাড়া"), g("Muksudpur", "মুকসুদপুর"), g("Tungipara", "টুঙ্গিপাড়া")],
  },
  {
    ...g("Habiganj", "হবিগঞ্জ"),
    division: "Sylhet",
    upazilas: [g("Ajmiriganj", "আজমিরিগঞ্জ"), g("Bahubal", "বাহুবল"), g("Baniachang", "বানিয়াচং"), g("Chunarughat", "চুনারুঘাট"), g("Habiganj Sadar", "হবিগঞ্জ সদর"), g("Lakhai", "লাক্ষাই"), g("Madhabpur", "মাধবপুর"), g("Nabiganj", "নবীগঞ্জ")],
  },
  {
    ...g("Jamalpur", "জামালপুর"),
    division: "Mymensingh",
    upazilas: [g("Baksiganj", "বকসিগঞ্জ"), g("Dewanganj", "দেওয়ানগঞ্জ"), g("Islampur", "ইসলামপুর"), g("Jamalpur Sadar", "জামালপুর সদর"), g("Madarganj", "মাদারগঞ্জ"), g("Melandaha", "মেলানদাহা"), g("Sarishabari", "সরিষাবাড়ি")],
  },
  {
    ...g("Jashore", "যশোর"),
    division: "Khulna",
    upazilas: [g("Abhaynagar", "অভয়নগর"), g("Bagherpara", "বাঘের পাড়া"), g("Chaugachha", "চৌগাছা"), g("Jhikargachha", "ঝিকরগাছা"), g("Keshabpur", "কেশবপুর"), g("Manirampur", "মনিরামপুর"), g("Sharsha", "সারশা")],
  },
  {
    ...g("Jhalokati", "ঝালকাঠি"),
    division: "Barishal",
    upazilas: [g("Jhalokati Sadar", "ঝালকাঠি সদর"), g("Nalchity", "নালচিতি"), g("Rajapur", "রাজাপুর")],
  },
  {
    ...g("Jhenaidah", "ঝিনাইদহ"),
    division: "Khulna",
    upazilas: [g("Harinakunda", "হাড়িনাকুন্দা"), g("Jhenaidah Sadar", "ঝিনাইদহ সদর"), g("Kaliganj", "কালীগঞ্জ"), g("Kotchandpur", "কোট চাঁদপুর"), g("Maheshpur", "মহেশপুর"), g("Shailkupa", "শৈলকুপা")],
  },
  {
    ...g("Joypurhat", "জয়পুরহাট"),
    division: "Rajshahi",
    upazilas: [g("Akkelpur", "আক্কেলপুর"), g("Joypurhat Sadar", "জয়পুরহাট সদর"), g("Kalai", "কালাই"), g("Khetlal", "খেতলাল"), g("Panchbibi", "পাঁচবিবি")],
  },
  {
    ...g("Khagrachari", "খাগড়াছড়ি"),
    division: "Chattogram",
    upazilas: [g("Dighinala", "দিঘিনালা"), g("Khagrachhari", "খাগড়াছড়ি"), g("Lakshmichhari", "লক্ষ্মীছড়ি"), g("Mahalchhari", "মহলছড়ি"), g("Manikchhari", "মানিকছড়ি"), g("Matiranga", "মাটিরাঙ্গা"), g("Panchhari", "পানছড়ি"), g("Ramgarh", "রামগড়")],
  },
  {
    ...g("Khulna", "খুলনা"),
    division: "Khulna",
    upazilas: [g("Batiaghata", "বাটিয়াঘাটা"), g("Dacope", "ডাকপে"), g("Dighalia", "দিঘলিয়া"), g("Dumuria", "ডুমুরিয়া"), g("Khalishpur", "খালিশপুর"), g("Khan Jahan Ali", "খান জাহান আলী"), g("Khulna Sadar", "খুলনা সদর"), g("Koyra", "কয়ড়া"), g("Paikgachha", "পাইকগাছা"), g("Phultala", "ফুলতলা"), g("Rupsa", "রূপসা"), g("Sonadanga", "সোনাডাঙ্গা"), g("Terokhada", "তেরোখাদা")],
  },
  {
    ...g("Kishoreganj", "কিশোরগঞ্জ"),
    division: "Dhaka",
    upazilas: [g("Bajitpur", "বাজিতপুর"), g("Bhairab", "ভৈরব"), g("Hossainpur", "হোসেনপুর"), g("Itna", "ইটনা"), g("Karimganj", "করিমগঞ্জ"), g("Katiadi", "কতিয়াদি"), g("Kishoreganj Sadar", "কিশোরগঞ্জ সদর"), g("Kuliarchar", "কুলিয়ারচর"), g("Mithamain", "মিঠামাইন"), g("Nikli", "নিকলি"), g("Pakundia", "পাকুন্ডা"), g("Tarail", "তাড়াইল")],
  },
  {
    ...g("Kurigram", "কুড়িগ্রাম"),
    division: "Rangpur",
    upazilas: [g("Bhurungamari", "ভুরুঙ্গামারি"), g("Char Rajibpur", "চর রাজিবপুর"), g("Chilmari", "চিলমারি"), g("Kurigram Sadar", "কুড়িগ্রাম সদর"), g("Lalmonirhat Sadar", "লালমনিরহাট সদর"), g("Nageshwari", "নাগেশ্বরী"), g("Phulbari", "ফুলবাড়ি"), g("Rajarhat", "রাজারহাট"), g("Raumari", "রৌমারী"), g("Ulipur", "উলিপুর")],
  },
  {
    ...g("Kushtia", "কুষ্টিয়া"),
    division: "Khulna",
    upazilas: [g("Bheramara", "ভেরামারা"), g("Daulatpur", "দৌলতপুর"), g("Khoksa", "খোকসা"), g("Kumarkhali", "কুমারখালি"), g("Kushtia Sadar", "কুষ্টিয়া সদর"), g("Mirpur", "মিরপুর")],
  },
  {
    ...g("Lakshmipur", "লক্ষ্মীপুর"),
    division: "Chattogram",
    upazilas: [g("Hajiganj", "হাজীগঞ্জ"), g("Kamalnagar", "কমলনগর"), g("Lakshmipur Sadar", "লক্ষ্মীপুর সদর"), g("Ramganj", "রামগঞ্জ"), g("Ramgati", "রামগতি"), g("Roypur", "রায়পুর")],
  },
  {
    ...g("Lalmonirhat", "লালমনিরহাট"),
    division: "Rangpur",
    upazilas: [g("Aditmari", "আদিতমারি"), g("Hatibandha", "হাতিবান্ধা"), g("Kaliganj", "কালীগঞ্জ"), g("Patgram", "পাটগ্রাম")],
  },
  {
    ...g("Madaripur", "মাদারীপুর"),
    division: "Dhaka",
    upazilas: [g("Kalkini", "কালকিনি"), g("Madaripur Sadar", "মাদারীপুর সদর"), g("Rajoir", "রাজইর"), g("Shibchar", "শিবচর")],
  },
  {
    ...g("Magura", "মাগুরা"),
    division: "Khulna",
    upazilas: [g("Magura Sadar", "মাগুরা সদর"), g("Mohammadpur", "মোহাম্মাদপুর"), g("Shalikha", "শালিখা"), g("Sreepur", "শ্রীপুর")],
  },
  {
    ...g("Manikganj", "মানিকগঞ্জ"),
    division: "Dhaka",
    upazilas: [g("Daulatpur", "দৌলতপুর"), g("Ghior", "ঘিওর"), g("Harirampur", "হরিরামপুর"), g("Manikganj Sadar", "মানিকগঞ্জ সদর"), g("Saturia", "সাটুরিয়া"), g("Shibalaya", "শিবালয়"), g("Singair", "সিঙ্গাইর")],
  },
  {
    ...g("Maulvibazar", "মৌলভীবাজার"),
    division: "Sylhet",
    upazilas: [g("Barlekha", "বড়লেখা"), g("Juri", "জুড়ি"), g("Kamalganj", "কামালগঞ্জ"), g("Kulaura", "কুলাউরা"), g("Moulvibazar Sadar", "মৌলভীবাজার"), g("Rajnagar", "রাজনগর"), g("Sreemangal", "শ্রীমঙ্গল")],
  },
  {
    ...g("Meherpur", "মেহেরপুর"),
    division: "Khulna",
    upazilas: [g("Mujib Nagar", "মুজিব নগর")],
  },
  {
    ...g("Munshiganj", "মুন্সিগঞ্জ"),
    division: "Dhaka",
    upazilas: [g("Gazaria", "গজারিয়া"), g("Lohajang", "লোহাজং"), g("Munshiganj Sadar", "মুন্সিগঞ্জ সদর"), g("Narayanganj Sadar", "নারায়ণগঞ্জ সদর"), g("Sirajdikhan", "সিরাজদিখান"), g("Sreenagar", "শ্রীনগর"), g("Tongibari", "টঙ্গিবাড়ি")],
  },
  {
    ...g("Mymensingh", "ময়মনসিংহ"),
    division: "Mymensingh",
    upazilas: [g("Bhaluka", "ভালুকা"), g("Dhobaura", "ধবারুয়া"), g("Fulbaria", "ফুলবাড়িয়া"), g("Gaffargaon", "গফরগাঁও"), g("Gauripur", "গৌরিপুর"), g("Haluaghat", "হালুয়াঘাট"), g("Ishwarganj", "ঈশ্বরগঞ্জ"), g("Muktagachha", "মুক্তাগাছা"), g("Mymensingh Sadar", "ময়মনসিং সদর"), g("Nandail", "নন্দাইল"), g("Phulpur", "ফুলপুর"), g("Trishal", "ত্রিশাল")],
  },
  {
    ...g("Naogaon", "নওগাঁ"),
    division: "Rajshahi",
    upazilas: [g("Atrai", "আত্রাই"), g("Badalgachhi", "বদলগাছি"), g("Dhamoirhat", "ধামইরহাট"), g("Manda", "মান্দা"), g("Mohadevpur", "মহাদেবপুর"), g("Naogaon Sadar", "নওগাঁ সদর"), g("Niamatpur", "নিয়ামতপুর"), g("Patnitala", "পত্নীতলা"), g("Porsha", "পোরশা"), g("Raninagar", "রাণীনগর"), g("Sapahar", "সাপাহার")],
  },
  {
    ...g("Narail", "নড়াইল"),
    division: "Khulna",
    upazilas: [g("Kalia Upazilla", "কালিয়া"), g("Lohagara Upazilla", "লোহাগাড়া"), g("Mohammadpur", "মোহাম্মদপুর"), g("Narail Sadar", "নড়াইল সদর")],
  },
  {
    ...g("Narayanganj", "নারায়াণগঞ্জ"),
    division: "Dhaka",
    upazilas: [g("Araihazar", "আড়াইহাজার"), g("Bandar", "বান্দার"), g("Narayanganj Sadar", "নারায়ণগঞ্জ সদর"), g("Rupganj", "রূপগঞ্জ"), g("Sonargaon", "সোনারগাঁও")],
  },
  {
    ...g("Narsingdi", "নরসিংদী"),
    division: "Dhaka",
    upazilas: [g("Belabo", "বেলাবো"), g("Monohardi", "মনোহরদি"), g("Narsingdi Sadar", "নরসিংদী সদর"), g("Palash", "পলাশ"), g("Shibpur", "শিবপুর")],
  },
  {
    ...g("Natore", "নাটোর"),
    division: "Rajshahi",
    upazilas: [g("Bagatipara", "বাগাতিপাড়া"), g("Baraigram", "বড়াইগ্রাম"), g("Gurudaspur", "গুরুদাসপুর"), g("Lalpur", "লালপুর"), g("Natore Sadar", "নাটোর সদর")],
  },
  {
    ...g("Nawabganj", "নবাবগঞ্জ"),
    division: "Rajshahi",
    upazilas: [g("Bholahat", "ভোলাহাট"), g("Gomastapur", "গোমস্তাপুর"), g("Nachole", "নাচোল"), g("Nawabganj Sadar", "নবাবগঞ্জ সদর"), g("Shibganj", "শিবগঞ্জ")],
  },
  {
    ...g("Netrokona", "নেত্রকোণা"),
    division: "Mymensingh",
    upazilas: [g("Atpara Upazilla", "আটপাড়া"), g("Barhatta Upazilla", "বরহাট্টা"), g("Durgapur Upazilla", "দুর্গাপুর"), g("Kalmakanda Upazilla", "কলমাকান্দা"), g("Kendua Upazilla", "কেন্দুয়া"), g("Khaliajuri Upazilla", "খালিয়াজুরি"), g("Madan Upazilla", "মদন"), g("Mohanganj Upazilla", "মোহনগঞ্জ"), g("Netrokona Sadar", "নেত্রকোনা সদর"), g("Purbadhala Upazilla", "পূর্বধলা")],
  },
  {
    ...g("Nilphamari", "নীলফামারী"),
    division: "Rangpur",
    upazilas: [g("Dimla", "ডিমলা"), g("Domar", "ডোমার"), g("Jaldhaka", "জলঢাকা"), g("Kishoreganj", "কিশোরগঞ্জ"), g("Nilphamari Sadar", "নীলফামারী সদর"), g("Saidpur", "সৈয়দপুর")],
  },
  {
    ...g("Noakhali", "নোয়াখালী"),
    division: "Chattogram",
    upazilas: [g("Begumganj", "বেগমগঞ্জ"), g("Chatkhil", "চাটখিল"), g("Manoharganj", "মনোহরগঞ্জ"), g("Noakhali Sadar", "নোয়াখালী সদর"), g("Sonaimuri", "সোনাইমুরি")],
  },
  {
    ...g("Pabna", "পাবনা"),
    division: "Rajshahi",
    upazilas: [g("Atgharia", "আটঘরিয়া"), g("Bera", "বেড়া"), g("Bhangura", "ভাঙ্গুরা"), g("Chatmohar", "চাটমোহর"), g("Faridpur", "ফরিদপুর"), g("Ishwardi", "ঈশ্বরদী"), g("Pabna Sadar", "পাবনা সদর"), g("Santhia", "সাথিয়া"), g("Sujanagar", "সুজানগর")],
  },
  {
    ...g("Panchagarh", "পঞ্চগড়"),
    division: "Rangpur",
    upazilas: [g("Atwari", "আটোয়ারি"), g("Boda", "বোদা"), g("Debiganj", "দেবীগঞ্জ"), g("Panchagarh Sadar", "পঞ্চগড় সদর"), g("Tetulia", "তেঁতুলিয়া")],
  },
  {
    ...g("Patuakhali", "পটুয়াখালী"),
    division: "Barishal",
    upazilas: [g("Bauphal", "বাউফল"), g("Dashmina", "দশমিনা"), g("Dumki", "ডুমকি"), g("Galachipa", "গলাচিপা"), g("Kalapara", "কালাপারা"), g("Mirzaganj", "মির্জাগঞ্জ"), g("Patuakhali Sadar", "পটুয়াখালী সদর")],
  },
  {
    ...g("Pirojpur", "পিরোজপুর"),
    division: "Barishal",
    upazilas: [g("Bhandaria", "ভ্যান্ডারিয়া"), g("Kanthalia", "কাঁঠালিয়া"), g("Kaukhali", "কাউখালি"), g("Mathbaria", "মাঠবাড়িয়া"), g("Nazirpur", "নাজিরপুর"), g("Nesarabad", "নেসারাবাদ"), g("Pirojpur Sadar", "পিরোজপুর সদর"), g("Zianagar", "জিয়ানগর")],
  },
  {
    ...g("Rajbari", "রাজবাড়ি"),
    division: "Dhaka",
    upazilas: [g("Baliakandi", "বালিয়াকান্দি"), g("Goalandaghat", "গোয়ালন্দ ঘাট"), g("Kalukhali", "কালুখালি"), g("Pangsha", "পাংশা"), g("Rajbari Sadar", "রাজবাড়ি সদর")],
  },
  {
    ...g("Rajshahi", "রাজশাহী"),
    division: "Rajshahi",
    upazilas: [g("Bagha", "বাঘা"), g("Bagmara", "বাগমারা"), g("Boalia", "বোয়ালিয়া"), g("Charghat", "চারঘাট"), g("Durgapur", "দুর্গাপুর"), g("Godagari", "গোদাগারি"), g("Matihar", "মতিহার"), g("Mohanpur", "মোহনপুর"), g("Paba", "পবা"), g("Puthia", "পুঠিয়া"), g("Rajpara", "রাজপাড়া"), g("Shah Makhdum", "শাহ মখদুম"), g("Tanore", "তানোর")],
  },
  {
    ...g("Rangamati", "রাঙ্গামাটি"),
    division: "Chattogram",
    upazilas: [g("Bagaichhari", "বাঘাইছড়ি"), g("Barkal", "বরকল"), g("Belaichhari", "বেলাইছড়ি"), g("Juraichhari", "জুরাইছড়ি"), g("Kaptai", "কাপ্তাই"), g("Langadu", "লাঙ্গাডু"), g("Nannerchar", "নান্নেরচর"), g("Rajasthali", "রাজাস্থলি"), g("Rangamati Sadar", "রাঙ্গামাটি সদর")],
  },
  {
    ...g("Rangpur", "রংপুর"),
    division: "Rangpur",
    upazilas: [g("Badarganj", "বদরগঞ্জ"), g("Gangachara", "গঙ্গাচরা"), g("Kaunia", "কাউনিয়া"), g("Mithapukur", "মিঠাপুকুর"), g("Pirgachha", "পীরগাছা"), g("Pirganj", "পীরগঞ্জ"), g("Rangpur Sadar", "রংপুর সদর"), g("Taraganj", "তারাগঞ্জ")],
  },
  {
    ...g("Satkhira", "সাতক্ষীরা"),
    division: "Khulna",
    upazilas: [g("Assasuni", "আসসাশুনি"), g("Debhata", "দেভাটা"), g("Kalaroa", "কলরোয়া"), g("Kaliganj", "কালীগঞ্জ"), g("Satkhira Sadar", "সাতক্ষীরা সদর"), g("Shyamnagar", "শ্যামনগর"), g("Tala", "তালা")],
  },
  {
    ...g("Shariatpur", "শরীয়তপুর"),
    division: "Dhaka",
    upazilas: [g("Bhedarganj", "ভেদারগঞ্জ"), g("Damudya", "দামুদিয়া"), g("Gosairhat", "গোসাইর হাট"), g("Naria", "নড়িয়া"), g("Shariatpur Sadar", "শরীয়তপুর সদর"), g("Zanjira", "জাজিরা")],
  },
  {
    ...g("Sherpur", "শেরপুর"),
    division: "Mymensingh",
    upazilas: [g("Jhenaigati", "ঝিনাইগাতি"), g("Nakla", "নাকলা"), g("Nalitabari", "নালিতাবাড়ি"), g("Sherpur Sadar", "শেরপুর সদর"), g("Sreebardi", "শ্রীবরদি")],
  },
  {
    ...g("Sirajgonj", "সিরাজগঞ্জ"),
    division: "Rajshahi",
    upazilas: [g("Belkuchi", "বেলকুচি"), g("Chauhali", "চৌহালি"), g("Kamarkhanda", "কামারখান্দা"), g("Kazipur", "কাজীপুর"), g("Royganj", "রায়গঞ্জ"), g("Shahjadpur", "শাহজাদপুর"), g("Singra", "সিংড়া"), g("Sirajganj Sadar", "সিরাজগঞ্জ সদর"), g("Tarash", "তারাশ"), g("Ullahpara", "উল্লাপাড়া")],
  },
  {
    ...g("Sunamganj", "সুনামগঞ্জ"),
    division: "Sylhet",
    upazilas: [g("Bishwamvarpur", "বিসশম্ভারপুর"), g("Chhatak", "ছাতক"), g("Dakshin Sunamganj", "দক্ষিণ সুনামগঞ্জ"), g("Derai", "দেড়াই"), g("Dharampasha", "ধরমপাশা"), g("Dowarabazar", "দোয়ারাবাজার"), g("Jagannathpur", "জগন্নাথপুর"), g("Jamalganj", "জামালগঞ্জ"), g("Sulla", "সুল্লা"), g("Sunamganj Sadar", "সুনামগঞ্জ সদর"), g("Tahirpur", "তাহিরপুর")],
  },
  {
    ...g("Sylhet", "সিলেট"),
    division: "Sylhet",
    upazilas: [g("Balaganj", "বালাগঞ্জ"), g("Beanibazar", "বেয়ানিবাজার"), g("Bishwanath", "বিশ্বনাথ"), g("Companiganj", "কোম্পানিগঞ্জ"), g("Dakshin Surma", "দক্ষিণ সুরমা"), g("Fenchuganj", "ফেঞ্চুগঞ্জ"), g("Golapganj", "গোলাপগঞ্জ"), g("Gowainghat", "গোয়াইনঘাট"), g("Jointapur", "জৈন্তাপুর"), g("Kabirhat", "কবিরহাট"), g("Kanaighat", "কানাইঘাট"), g("Senbagh", "সেনবাগ"), g("Sylhet Sadar", "সিলেট সদর"), g("Zakiganj", "জাকিগঞ্জ")],
  },
  {
    ...g("Tangail", "টাঙ্গাইল"),
    division: "Dhaka",
    upazilas: [g("Basail", "বসাইল"), g("Bhuapur", "ভুয়াপুর"), g("Delduar", "দেলদুয়ার"), g("Dhanbari", "ধানবাড়ি"), g("Ghatail", "ঘাটাইল"), g("Gopalpur", "গোপালপুর"), g("Kalihati", "কালিহাতি"), g("Madhupur", "মধুপুর"), g("Mirzapur", "মির্জাপুর"), g("Nagarpur", "নগরপুর"), g("Sakhipur", "সখিপুর"), g("Tangail Sadar", "টাঙ্গাইল সদর")],
  },
  {
    ...g("Thakurgaon", "ঠাকুরগাঁও"),
    division: "Rangpur",
    upazilas: [g("Baliadangi", "বালিয়াডাঙ্গি"), g("Haripur", "হরিপুর"), g("Pirganj", "পীরগঞ্জ"), g("Ranisankail", "রাণীসংকইল"), g("Thakurgaon Sadar", "ঠাকুরগাঁও সদর")],
  },
];

export const DIVISIONS: GeoOption[] = [
  g("Barishal", "বরিশাল"),
  g("Chattogram", "চট্টগ্রাম"),
  g("Dhaka", "ঢাকা"),
  g("Khulna", "খুলনা"),
  g("Mymensingh", "ময়মনসিংহ"),
  g("Rajshahi", "রাজশাহী"),
  g("Rangpur", "রংপুর"),
  g("Sylhet", "সিলেট"),
];

export const districtsOf = (division: string): District[] => DISTRICTS.filter((d) => d.division === division);

export const divisionOf = (district: string): string => DISTRICTS.find((d) => d.value === district)?.division ?? "";

export const upazilasOf = (district: string): GeoOption[] =>
  DISTRICTS.find((d) => d.value === district)?.upazilas ?? [];

/** Place names always show both scripts, e.g. "Dhaka (ঢাকা)", whatever the site language. */
export const labelOf = (o: GeoOption, _locale?: string): string => o.bn ? `${o.en} (${o.bn})` : o.en;
