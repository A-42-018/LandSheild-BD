/** Static geo list (all 64 districts and their upazilas/thanas). `value` is the English name sent to the API; labels are display-only. */
export interface GeoOption {
  value: string;
  en: string;
  bn: string;
}
export interface District extends GeoOption {
  upazilas: GeoOption[];
}

const g = (en: string, bn: string): GeoOption => ({ value: en, en, bn });

export const DISTRICTS: District[] = [
  {
    ...g("Bagerhat", "বাগেরহাট"),
    upazilas: [g("Bagerhat Sadar", "বাগেরহাট সদর"), g("Chitalmari", "চিতলমাড়ি"), g("Fakirhat", "ফকিরহাট"), g("Kachua", "কচুয়া"), g("Mollahat", "মোল্লাহাট"), g("Mongla", "মংলা"), g("Morrelganj", "মরেলগঞ্জ"), g("Rampal", "রামপাল"), g("Sarankhola", "স্মরণখোলা")],
  },
  {
    ...g("Bandarban", "বান্দরবান"),
    upazilas: [g("Ali kadam", "আলী কদম"), g("Bandarban Sadar", "বান্দরবন সদর"), g("Lama", "লামা"), g("Naikhongchhari", "নাইখংছড়ি"), g("Rowangchhari", "রউয়াংছড়ি"), g("Ruma", "রুমা"), g("Thanchi", "থানচি")],
  },
  {
    ...g("Barguna", "বরগুনা"),
    upazilas: [g("Amtali", "আমতলী"), g("Bamna", "বামনা"), g("Barguna Sadar", "বরগুনা সদর"), g("Betagi", "বেতাগি"), g("Patharghata", "পাথরঘাটা")],
  },
  {
    ...g("Barishal", "বরিশাল"),
    upazilas: [g("Agailjhara", "আগাইলঝরা"), g("Babuganj", "বাবুগঞ্জ"), g("Bakerganj", "বাকেরগঞ্জ"), g("Banaripara", "বানাড়িপারা"), g("Barisal Sadar", "বরিশাল সদর"), g("Gaurnadi", "গৌরনদী"), g("Hizla", "হিজলা"), g("Mehendiganj", "মেহেদিগঞ্জ"), g("Muladi", "মুলাদি"), g("Wazirpur", "ওয়াজিরপুর")],
  },
  {
    ...g("Bhola", "ভোলা"),
    upazilas: [g("Bhola Sadar", "ভোলা সদর"), g("Burhanuddin", "বুরহানউদ্দিন"), g("Char Fasson", "চর ফ্যাশন"), g("Daulatkhan", "দৌলতখান"), g("Hatiya", ""), g("Lalmohan", "লালমোহন"), g("Manpura", "মনপুরা"), g("Tazumuddin", "তাজুমুদ্দিন")],
  },
  {
    ...g("Bogura", "বগুড়া"),
    upazilas: [g("Adamdighi", "আদমদিঘী"), g("Bogra Sadar", "বগুড়া সদর"), g("Dhunat", "ধুনট"), g("Dhupchanchia", "দুপচাচিয়া"), g("Gabtali", "গাবতলি"), g("Kahaloo", "কাহালু"), g("Nandigram", "নন্দিগ্রাম"), g("Sahajanpur", "শাহজাহানপুর"), g("Sariakandi", "সারিয়াকান্দি"), g("Sherpur", "শেরপুর"), g("Shibganj", "শিবগঞ্জ"), g("Sonatala", "সোনাতলা")],
  },
  {
    ...g("Brahmanbaria", "ব্রাহ্মণবাড়িয়া"),
    upazilas: [g("Akhaura", "আখাউরা"), g("Ashuganj", "আশুগঞ্জ"), g("Austagram", ""), g("Bancharampur", "বাঞ্ছারামপুর"), g("Bijoynagar", "বিজয় নগর"), g("Brahmanbaria Sadar", "ব্রাহ্মণবাড়িয়া সদর"), g("Kasba", "কসবা"), g("Nabinagar", "নবীনগর"), g("Nasirnagar", "নাসির নগর"), g("Roypura", ""), g("Sarail", "সরাইল")],
  },
  {
    ...g("Chandpur", "চাঁদপুর"),
    upazilas: [g("Chandpur Sadar", "চাঁদপুর সদর"), g("Faridganj", "ফরিদগঞ্জ"), g("Haimchar", "হাইমচর"), g("Kachua", "কচুয়া"), g("Matlab Dakkhin", "মতলব দক্ষিণ"), g("Matlab Uttar", "মতলব উত্তর"), g("Shahrasti", "শাহরাস্তি")],
  },
  {
    ...g("Chattogram", "চট্টগ্রাম"),
    upazilas: [g("Anwara", "আনোয়ারা"), g("Bakalia", ""), g("Banshkhali", "বাশখালি"), g("Bayejid Bostami", ""), g("Boalkhali", "বোয়ালখালি"), g("Chandanaish", "চন্দনাইশ"), g("Chandgaon", ""), g("Chittagong Port", ""), g("Double Mooring", ""), g("Fatikchhari", "ফটিকছড়ি"), g("Halishahar", ""), g("Hathazari", "হাঠহাজারী"), g("Kawkhali (Betbunia)", ""), g("Khulshi", ""), g("Kotwali", ""), g("Lohagara", "লোহাগারা"), g("Mirsharai", "মিরসরাই"), g("Pahartali", ""), g("Panchlaish", ""), g("Patenga", ""), g("Patiya", "পটিয়া"), g("Rangunia", "রাঙ্গুনিয়া"), g("Raozan", "রাউজান"), g("Sandwip", "সন্দ্বীপ"), g("Satkania", "সাতকানিয়া"), g("Sitakunda", "সীতাকুণ্ড"), g("Subarnachar", "")],
  },
  {
    ...g("Chuadanga", "চুয়াডাঙ্গা"),
    upazilas: [g("Alamdanga", "আলমডাঙ্গা"), g("Chuadanga Sadar", "চুয়াডাঙ্গা সদর"), g("Damurhuda", "দামুরহুদা"), g("Gangni", ""), g("Jibannagar", "জীবন নগর"), g("Meherpur Sadar", ""), g("Mirpur", "")],
  },
  {
    ...g("Cox's Bazar", "কক্স বাজার"),
    upazilas: [g("Chakaria", "চকরিয়া"), g("Cox's Bazar Sadar", "কক্স বাজার সদর"), g("Kutubdia", "কুতুবদিয়া"), g("Maheshkhali", "মহেশখালী"), g("Pekua", "পেকুয়া"), g("Ramu", "রামু"), g("Teknaf", "টেকনাফ"), g("Ukhia", "উখিয়া")],
  },
  {
    ...g("Cumilla", "কুমিল্লা"),
    upazilas: [g("Barura", "বড়ুরা"), g("Brahmanpara", "ব্রাহ্মণপাড়া"), g("Burichong", "বুড়িচং"), g("Chandina", "চান্দিনা"), g("Chauddagram", "চৌদ্দগ্রাম"), g("Comilla Adarsha Sadar", ""), g("Comilla Sadar South", "কুমিল্লা সদর দক্ষিণ"), g("Daudkandi", "দাউদকান্দি"), g("Debidwar", "দেবীদ্বার"), g("Homna", "হোমনা"), g("Laksam", "লাকসাম"), g("Meghna", "মেঘনা"), g("Muradnagar", "মুরাদনগর"), g("Nangalkot", "নাঙ্গালকোট"), g("Titas", "তিতাস")],
  },
  {
    ...g("Dhaka", "ঢাকা"),
    upazilas: [g("Bangshal", ""), g("Biman Bandar", ""), g("Chak Bazar", ""), g("Dhamrai", "ধামরাই"), g("Dohar", "দোহার"), g("Gendaria", ""), g("Hazaribagh", ""), g("Jatrabari", ""), g("Kadamtali", ""), g("Kamrangir Char", ""), g("Keraniganj", "কেরানীগঞ্জ"), g("Kotwali", ""), g("Lalbagh", ""), g("Motijheel", ""), g("Nawabganj", "নবাবগঞ্জ"), g("Paltan", ""), g("Sabujbagh", ""), g("Savar", "সাভার"), g("Shyampur", ""), g("Sutrapur", ""), g("Turag", ""), g("Uttara", "")],
  },
  {
    ...g("Dinajpur", "দিনাজপুর"),
    upazilas: [g("Biral", "বিড়াল"), g("Birampur", "বিরামপুর"), g("Birganj", "বীরগঞ্জ"), g("Bochaganj", "বোচাগঞ্জ"), g("Chirirbandar", "চিরিরবন্দর"), g("Dinajpur Sadar", "দিনাজপুর সদর"), g("Ghoraghat", "ঘোড়াঘাট"), g("Hakimpur", "হাকিমপুর"), g("Kaharole", "কাহারোল"), g("Khansama", "খানসামা"), g("Nawabganj", "নবাবগঞ্জ"), g("Parbatipur", "পার্বতীপুর"), g("Phulbari", "ফুলবাড়ি")],
  },
  {
    ...g("Faridpur", "ফরিদপুর"),
    upazilas: [g("Alfadanga", "আলফাডাঙ্গা"), g("Bhanga", "ভাঙ্গা"), g("Boalmari", "বোয়ালমারী"), g("Charbhadrasan", "চরভদ্রাসন"), g("Faridpur Sadar", "ফরিদপুর সদর"), g("Madhukhali", "মধুখালি"), g("Nagarkanda", "নগরকান্ড"), g("Sadarpur", "সদরপুর"), g("Shaltha", "শালথা")],
  },
  {
    ...g("Feni", "ফেনী"),
    upazilas: [g("Chagalnaiya", "ছাগল নাইয়া"), g("Daganbhyan", "দাগানভিয়া"), g("Feni Sadar", "ফেনী সদর"), g("Fhulgazi", "ফুলগাজি"), g("Parshuram", "পরশুরাম"), g("Sonagazi", "সোনাগাজি")],
  },
  {
    ...g("Gaibandha", "গাইবান্ধা"),
    upazilas: [g("Fulchhari", "ফুলছড়ি"), g("Gaibandha sadar", "গাইবান্ধা সদর"), g("Gobindaganj", "গোবিন্দগঞ্জ"), g("Palashbari", "পলাশবাড়ী"), g("Sadullapur", "সাদুল্যাপুর"), g("Saghata", "সাঘাটা"), g("Sundarganj", "সুন্দরগঞ্জ")],
  },
  {
    ...g("Gazipur", "গাজীপুর"),
    upazilas: [g("Dakshinkhan", ""), g("Gazipur Sadar", "গাজীপুর সদর"), g("Kaliakair", "কালিয়াকৈর"), g("Kaliganj", "কালীগঞ্জ"), g("Kapasia", "কাপাসিয়া"), g("Sreepur", "শ্রীপুর"), g("Uttar Khan", "")],
  },
  {
    ...g("Gopalganj", "গোপালগঞ্জ"),
    upazilas: [g("Gopalganj Sadar", "গোপালগঞ্জ সদর"), g("Kashiani", "কাশিয়ানি"), g("Kotalipara", "কোটালিপাড়া"), g("Muksudpur", "মুকসুদপুর"), g("Tungipara", "টুঙ্গিপাড়া")],
  },
  {
    ...g("Habiganj", "হবিগঞ্জ"),
    upazilas: [g("Ajmiriganj", "আজমিরিগঞ্জ"), g("Bahubal", "বাহুবল"), g("Baniachang", "বানিয়াচং"), g("Chunarughat", "চুনারুঘাট"), g("Habiganj Sadar", "হবিগঞ্জ সদর"), g("Lakhai", "লাক্ষাই"), g("Madhabpur", "মাধবপুর"), g("Nabiganj", "নবীগঞ্জ")],
  },
  {
    ...g("Jamalpur", "জামালপুর"),
    upazilas: [g("Baksiganj", "বকসিগঞ্জ"), g("Dewanganj", "দেওয়ানগঞ্জ"), g("Islampur", "ইসলামপুর"), g("Jamalpur Sadar", "জামালপুর সদর"), g("Madarganj", "মাদারগঞ্জ"), g("Melandaha", "মেলানদাহা"), g("Sarishabari", "সরিষাবাড়ি")],
  },
  {
    ...g("Jashore", "যশোর"),
    upazilas: [g("Abhaynagar", "অভয়নগর"), g("Bagherpara", "বাঘের পাড়া"), g("Chaugachha", "চৌগাছা"), g("Jhikargachha", "ঝিকরগাছা"), g("Keshabpur", "কেশবপুর"), g("Kotwali", ""), g("Manirampur", "মনিরামপুর"), g("Sharsha", "সারশা")],
  },
  {
    ...g("Jhalokati", "ঝালকাঠি"),
    upazilas: [g("Jhalokati Sadar", "ঝালকাঠি সদর"), g("Nalchity", "নালচিতি"), g("Rajapur", "রাজাপুর")],
  },
  {
    ...g("Jhenaidah", "ঝিনাইদহ"),
    upazilas: [g("Harinakunda", "হাড়িনাকুন্দা"), g("Jhenaidah Sadar", "ঝিনাইদহ সদর"), g("Kaliganj", "কালীগঞ্জ"), g("Kotchandpur", "কোট চাঁদপুর"), g("Maheshpur", "মহেশপুর"), g("Shailkupa", "শৈলকুপা")],
  },
  {
    ...g("Joypurhat", "জয়পুরহাট"),
    upazilas: [g("Akkelpur", "আক্কেলপুর"), g("Joypurhat Sadar", "জয়পুরহাট সদর"), g("Kalai", "কালাই"), g("Khetlal", "খেতলাল"), g("Panchbibi", "পাঁচবিবি")],
  },
  {
    ...g("Khagrachari", "খাগড়াছড়ি"),
    upazilas: [g("Dighinala", "দিঘিনালা"), g("Khagrachhari", "খাগড়াছড়ি"), g("Lakshmichhari", "লক্ষ্মীছড়ি"), g("Mahalchhari", "মহলছড়ি"), g("Manikchhari", "মানিকছড়ি"), g("Matiranga", "মাটিরাঙ্গা"), g("Panchhari", "পানছড়ি"), g("Ramgarh", "রামগড়")],
  },
  {
    ...g("Khulna", "খুলনা"),
    upazilas: [g("Batiaghata", "বাটিয়াঘাটা"), g("Dacope", "ডাকপে"), g("Dighalia", "দিঘলিয়া"), g("Dumuria", "ডুমুরিয়া"), g("Khalishpur", ""), g("Khan Jahan Ali", ""), g("Khulna Sadar", ""), g("Koyra", "কয়ড়া"), g("Paikgachha", "পাইকগাছা"), g("Phultala", "ফুলতলা"), g("Rupsa", "রূপসা"), g("Sonadanga", ""), g("Terokhada", "তেরোখাদা")],
  },
  {
    ...g("Kishoreganj", "কিশোরগঞ্জ"),
    upazilas: [g("Bajitpur", "বাজিতপুর"), g("Bhairab", "ভৈরব"), g("Hossainpur", "হোসেনপুর"), g("Itna", "ইটনা"), g("Karimganj", "করিমগঞ্জ"), g("Katiadi", "কতিয়াদি"), g("Kishoreganj Sadar", "কিশোরগঞ্জ সদর"), g("Kuliarchar", "কুলিয়ারচর"), g("Mithamain", "মিঠামাইন"), g("Nikli", "নিকলি"), g("Pakundia", "পাকুন্ডা"), g("Tarail", "তাড়াইল")],
  },
  {
    ...g("Kurigram", "কুড়িগ্রাম"),
    upazilas: [g("Bhurungamari", "ভুরুঙ্গামারি"), g("Char Rajibpur", "চর রাজিবপুর"), g("Chilmari", "চিলমারি"), g("Kurigram Sadar", "কুড়িগ্রাম সদর"), g("Lalmonirhat Sadar", ""), g("Nageshwari", "নাগেশ্বরী"), g("Phulbari", "ফুলবাড়ি"), g("Rajarhat", "রাজারহাট"), g("Raumari", ""), g("Ulipur", "উলিপুর")],
  },
  {
    ...g("Kushtia", "কুষ্টিয়া"),
    upazilas: [g("Bheramara", "ভেরামারা"), g("Cantonment", ""), g("Darus Salam", ""), g("Daulatpur", "দৌলতপুর"), g("Gulshan", ""), g("Kafrul", ""), g("Khoksa", "খোকসা"), g("Kumarkhali", "কুমারখালি"), g("Kushtia Sadar", "কুষ্টিয়া সদর"), g("Mirpur", "মিরপুর"), g("Pallabi", ""), g("Shah Ali", "")],
  },
  {
    ...g("Lakshmipur", "লক্ষ্মীপুর"),
    upazilas: [g("Hajiganj", ""), g("Kamalnagar", ""), g("Lakshmipur Sadar", "লক্ষ্মীপুর সদর"), g("Ramganj", "রামগঞ্জ"), g("Ramgati", "রামগতি"), g("Roypur", "")],
  },
  {
    ...g("Lalmonirhat", "লালমনিরহাট"),
    upazilas: [g("Aditmari", "আদিতমারি"), g("Hatibandha", "হাতিবান্ধা"), g("Kaliganj", "কালীগঞ্জ"), g("Patgram", "পাটগ্রাম")],
  },
  {
    ...g("Madaripur", "মাদারীপুর"),
    upazilas: [g("Kalkini", "কালকিনি"), g("Madaripur Sadar", "মাদারীপুর সদর"), g("Rajoir", "রাজইর"), g("Shibchar", "শিবচর")],
  },
  {
    ...g("Magura", "মাগুরা"),
    upazilas: [g("Adabor", ""), g("Dhanmondi", ""), g("Kalabagan", ""), g("Kaliakair", ""), g("Magura Sadar", "মাগুরা সদর"), g("Mohammadpur", "মোহাম্মাদপুর"), g("New Market", ""), g("Ramna", ""), g("Rampura", ""), g("Shahbagh", ""), g("Shalikha", "শালিখা"), g("Sher-e-bangla Nagar", ""), g("Sreepur", "শ্রীপুর"), g("Tejgaon", ""), g("Tejgaon Ind. Area", "")],
  },
  {
    ...g("Manikganj", "মানিকগঞ্জ"),
    upazilas: [g("Daulatpur", "দৌলতপুর"), g("Ghior", "ঘিওর"), g("Harirampur", "হরিরামপুর"), g("Manikganj Sadar", "মানিকগঞ্জ সদর"), g("Saturia", "সাটুরিয়া"), g("Shibalaya", "শিবালয়"), g("Singair", "সিঙ্গাইর")],
  },
  {
    ...g("Maulvibazar", "মৌলভীবাজার"),
    upazilas: [g("Barlekha", "বড়লেখা"), g("Juri", "জুড়ি"), g("Kamalganj", "কামালগঞ্জ"), g("Kulaura", "কুলাউরা"), g("Moulvibazar Sadar", "মৌলভীবাজার"), g("Rajnagar", "রাজনগর"), g("Sreemangal", "শ্রীমঙ্গল")],
  },
  {
    ...g("Meherpur", "মেহেরপুর"),
    upazilas: [g("Mujib Nagar", "মুজিব নগর")],
  },
  {
    ...g("Munshiganj", "মুন্সিগঞ্জ"),
    upazilas: [g("Gazaria", "গজারিয়া"), g("Lohajang", "লোহাজং"), g("Munshiganj Sadar", "মুন্সিগঞ্জ সদর"), g("Narayanganj Sadar", ""), g("Sirajdikhan", "সিরাজদিখান"), g("Sreenagar", "শ্রীনগর"), g("Tongibari", "টঙ্গিবাড়ি")],
  },
  {
    ...g("Mymensingh", "ময়মনসিংহ"),
    upazilas: [g("Bhaluka", "ভালুকা"), g("Dhobaura", "ধবারুয়া"), g("Fulbaria", "ফুলবাড়িয়া"), g("Gaffargaon", "গফরগাঁও"), g("Gauripur", "গৌরিপুর"), g("Haluaghat", "হালুয়াঘাট"), g("Ishwarganj", "ঈশ্বরগঞ্জ"), g("Muktagachha", "মুক্তাগাছা"), g("Mymensingh Sadar", "ময়মনসিং সদর"), g("Nandail", "নন্দাইল"), g("Phulpur", "ফুলপুর"), g("Trishal", "ত্রিশাল")],
  },
  {
    ...g("Naogaon", "নওগাঁ"),
    upazilas: [g("Atrai", "আত্রাই"), g("Badalgachhi", "বদলগাছি"), g("Dhamoirhat", "ধামইরহাট"), g("Manda", "মান্দা"), g("Mohadevpur", "মহাদেবপুর"), g("Naogaon Sadar", "নওগাঁ সদর"), g("Niamatpur", "নিয়ামতপুর"), g("Patnitala", "পত্নীতলা"), g("Porsha", "পোরশা"), g("Raninagar", "রাণীনগর"), g("Sapahar", "সাপাহার")],
  },
  {
    ...g("Narail", "নড়াইল"),
    upazilas: [g("Kalia Upazilla", "কালিয়া"), g("Lohagara Upazilla", "লোহাগাড়া"), g("Mohammadpur", ""), g("Narail Sadar", "নড়াইল সদর")],
  },
  {
    ...g("Narayanganj", "নারায়াণগঞ্জ"),
    upazilas: [g("Araihazar", "আড়াইহাজার"), g("Badda", ""), g("Bandar", "বান্দার"), g("Demra", ""), g("Khilgaon", ""), g("Khilkhet", ""), g("Narayanganj Sadar", "নারায়ণগঞ্জ সদর"), g("Rupganj", "রূপগঞ্জ"), g("Sonargaon", "সোনারগাঁও")],
  },
  {
    ...g("Narsingdi", "নরসিংদী"),
    upazilas: [g("Belabo", "বেলাবো"), g("Monohardi", "মনোহরদি"), g("Narsingdi Sadar", "নরসিংদী সদর"), g("Palash", "পলাশ"), g("Shibpur", "শিবপুর")],
  },
  {
    ...g("Natore", "নাটোর"),
    upazilas: [g("Bagatipara", "বাগাতিপাড়া"), g("Baraigram", "বড়াইগ্রাম"), g("Gurudaspur", ""), g("Lalpur", "লালপুর"), g("Natore Sadar", "নাটোর সদর")],
  },
  {
    ...g("Nawabganj", "নবাবগঞ্জ"),
    upazilas: [g("Bholahat", "ভোলাহাট"), g("Gomastapur", "গোমস্তাপুর"), g("Nachole", "নাচোল"), g("Nawabganj Sadar", "নবাবগঞ্জ সদর"), g("Shibganj", "শিবগঞ্জ")],
  },
  {
    ...g("Netrokona", "নেত্রকোণা"),
    upazilas: [g("Atpara Upazilla", "আটপাড়া"), g("Barhatta Upazilla", "বরহাট্টা"), g("Durgapur Upazilla", "দুর্গাপুর"), g("Kalmakanda Upazilla", "কলমাকান্দা"), g("Kendua Upazilla", "কেন্দুয়া"), g("Khaliajuri Upazilla", "খালিয়াজুরি"), g("Madan Upazilla", "মদন"), g("Mohanganj Upazilla", "মোহনগঞ্জ"), g("Netrokona Sadar", "নেত্রকোনা সদর"), g("Purbadhala Upazilla", "পূর্বধলা")],
  },
  {
    ...g("Nilphamari", "নীলফামারী"),
    upazilas: [g("Dimla", "ডিমলা"), g("Domar", "ডোমার"), g("Jaldhaka", "জলঢাকা"), g("Kishoreganj", "কিশোরগঞ্জ"), g("Nilphamari Sadar", "নীলফামারী সদর"), g("Saidpur", "সৈয়দপুর")],
  },
  {
    ...g("Noakhali", "নোয়াখালী"),
    upazilas: [g("Begumganj", "বেগমগঞ্জ"), g("Chatkhil", "চাটখিল"), g("Manoharganj", ""), g("Noakhali Sadar", "নোয়াখালী সদর"), g("Sonaimuri", "সোনাইমুরি")],
  },
  {
    ...g("Pabna", "পাবনা"),
    upazilas: [g("Atgharia", "আটঘরিয়া"), g("Bera", "বেড়া"), g("Bhangura", "ভাঙ্গুরা"), g("Chatmohar", "চাটমোহর"), g("Faridpur", "ফরিদপুর"), g("Ishwardi", "ঈশ্বরদী"), g("Pabna Sadar", "পাবনা সদর"), g("Santhia", "সাথিয়া"), g("Sujanagar", "সুজানগর")],
  },
  {
    ...g("Panchagarh", "পঞ্চগড়"),
    upazilas: [g("Atwari", "আটোয়ারি"), g("Boda", "বোদা"), g("Debiganj", "দেবীগঞ্জ"), g("Panchagarh Sadar", "পঞ্চগড় সদর"), g("Tetulia", "তেঁতুলিয়া")],
  },
  {
    ...g("Patuakhali", "পটুয়াখালী"),
    upazilas: [g("Bauphal", "বাউফল"), g("Dashmina", "দশমিনা"), g("Dumki", "ডুমকি"), g("Galachipa", "গলাচিপা"), g("Kalapara", "কালাপারা"), g("Mirzaganj", "মির্জাগঞ্জ"), g("Patuakhali Sadar", "পটুয়াখালী সদর")],
  },
  {
    ...g("Pirojpur", "পিরোজপুর"),
    upazilas: [g("Bhandaria", "ভ্যান্ডারিয়া"), g("Kanthalia", ""), g("Kaukhali", "কাউখালি"), g("Mathbaria", "মাঠবাড়িয়া"), g("Nazirpur", "নাজিরপুর"), g("Nesarabad", "নেসারাবাদ"), g("Pirojpur Sadar", "পিরোজপুর সদর"), g("Zianagar", "জিয়ানগর")],
  },
  {
    ...g("Rajbari", "রাজবাড়ি"),
    upazilas: [g("Baliakandi", "বালিয়াকান্দি"), g("Goalandaghat", "গোয়ালন্দ ঘাট"), g("Kalukhali", "কালুখালি"), g("Pangsha", "পাংশা"), g("Rajbari Sadar", "রাজবাড়ি সদর")],
  },
  {
    ...g("Rajshahi", "রাজশাহী"),
    upazilas: [g("Bagha", "বাঘা"), g("Bagmara", "বাগমারা"), g("Boalia", ""), g("Charghat", "চারঘাট"), g("Durgapur", "দুর্গাপুর"), g("Godagari", "গোদাগারি"), g("Matihar", ""), g("Mohanpur", "মোহনপুর"), g("Paba", "পবা"), g("Puthia", "পুঠিয়া"), g("Rajpara", ""), g("Shah Makhdum", ""), g("Tanore", "তানোর")],
  },
  {
    ...g("Rangamati", "রাঙ্গামাটি"),
    upazilas: [g("Bagaichhari", "বাঘাইছড়ি"), g("Barkal", "বরকল"), g("Belaichhari", "বেলাইছড়ি"), g("Juraichhari", "জুরাইছড়ি"), g("Kaptai", "কাপ্তাই"), g("Langadu", "লাঙ্গাডু"), g("Nannerchar", "নান্নেরচর"), g("Rajasthali", "রাজাস্থলি"), g("Rangamati Sadar", "রাঙ্গামাটি সদর")],
  },
  {
    ...g("Rangpur", "রংপুর"),
    upazilas: [g("Badarganj", "বদরগঞ্জ"), g("Gangachara", "গঙ্গাচরা"), g("Kaunia", "কাউনিয়া"), g("Mithapukur", "মিঠাপুকুর"), g("Pirgachha", "পীরগাছা"), g("Pirganj", "পীরগঞ্জ"), g("Rangpur Sadar", "রংপুর সদর"), g("Taraganj", "তারাগঞ্জ")],
  },
  {
    ...g("Satkhira", "সাতক্ষীরা"),
    upazilas: [g("Assasuni", "আসসাশুনি"), g("Debhata", "দেভাটা"), g("Kalaroa", "কলরোয়া"), g("Kaliganj", "কালীগঞ্জ"), g("Satkhira Sadar", "সাতক্ষীরা সদর"), g("Shyamnagar", "শ্যামনগর"), g("Tala", "তালা")],
  },
  {
    ...g("Shariatpur", "শরীয়তপুর"),
    upazilas: [g("Bhedarganj", "ভেদারগঞ্জ"), g("Damudya", "দামুদিয়া"), g("Gosairhat", "গোসাইর হাট"), g("Naria", "নড়িয়া"), g("Shariatpur Sadar", "শরীয়তপুর সদর"), g("Zanjira", "")],
  },
  {
    ...g("Sherpur", "শেরপুর"),
    upazilas: [g("Jhenaigati", "ঝিনাইগাতি"), g("Nakla", "নাকলা"), g("Nalitabari", "নালিতাবাড়ি"), g("Sherpur Sadar", "শেরপুর সদর"), g("Sreebardi", "শ্রীবরদি")],
  },
  {
    ...g("Sirajgonj", "সিরাজগঞ্জ"),
    upazilas: [g("Belkuchi", "বেলকুচি"), g("Chauhali", "চৌহালি"), g("Kamarkhanda", "কামারখান্দা"), g("Kazipur", "কাজীপুর"), g("Royganj", ""), g("Shahjadpur", "শাহজাদপুর"), g("Singra", ""), g("Sirajganj Sadar", "সিরাজগঞ্জ সদর"), g("Tarash", "তারাশ"), g("Ullahpara", "উল্লাপাড়া")],
  },
  {
    ...g("Sunamganj", "সুনামগঞ্জ"),
    upazilas: [g("Bishwamvarpur", "বিসশম্ভারপুর"), g("Chhatak", "ছাতক"), g("Dakshin Sunamganj", ""), g("Derai", "দেড়াই"), g("Dharampasha", "ধরমপাশা"), g("Dowarabazar", "দোয়ারাবাজার"), g("Jagannathpur", "জগন্নাথপুর"), g("Jamalganj", "জামালগঞ্জ"), g("Sulla", "সুল্লা"), g("Sunamganj Sadar", "সুনামগঞ্জ সদর"), g("Tahirpur", "তাহিরপুর")],
  },
  {
    ...g("Sylhet", "সিলেট"),
    upazilas: [g("Balaganj", "বালাগঞ্জ"), g("Beanibazar", "বেয়ানিবাজার"), g("Bishwanath", "বিশ্বনাথ"), g("Companiganj", "কোম্পানিগঞ্জ"), g("Dakshin Surma", "দক্ষিণ সুরমা"), g("Fenchuganj", "ফেঞ্চুগঞ্জ"), g("Golapganj", "গোলাপগঞ্জ"), g("Gowainghat", "গোয়াইনঘাট"), g("Jointapur", "জৈন্তাপুর"), g("Kabirhat", ""), g("Kanaighat", "কানাইঘাট"), g("Senbagh", ""), g("Sylhet Sadar", "সিলেট সদর"), g("Zakiganj", "জাকিগঞ্জ")],
  },
  {
    ...g("Tangail", "টাঙ্গাইল"),
    upazilas: [g("Basail", "বসাইল"), g("Bhuapur", "ভুয়াপুর"), g("Delduar", "দেলদুয়ার"), g("Dhanbari", "ধানবাড়ি"), g("Ghatail", "ঘাটাইল"), g("Gopalpur", "গোপালপুর"), g("Kalihati", "কালিহাতি"), g("Madhupur", "মধুপুর"), g("Mirzapur", "মির্জাপুর"), g("Nagarpur", "নগরপুর"), g("Sakhipur", "সখিপুর"), g("Tangail Sadar", "টাঙ্গাইল সদর")],
  },
  {
    ...g("Thakurgaon", "ঠাকুরগাঁও"),
    upazilas: [g("Baliadangi", "বালিয়াডাঙ্গি"), g("Haripur", "হরিপুর"), g("Pirganj", "পীরগঞ্জ"), g("Ranisankail", "রাণীসংকইল"), g("Thakurgaon Sadar", "ঠাকুরগাঁও সদর")],
  },
];

export const upazilasOf = (district: string): GeoOption[] =>
  DISTRICTS.find((d) => d.value === district)?.upazilas ?? [];

export const labelOf = (o: GeoOption, locale: string): string => (locale === "bn" ? o.bn : o.en);
