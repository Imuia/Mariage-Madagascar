# PROPOSITION DE STRUCTURE FONCTIONNELLE : FICHES DE PRODUCTION & COMMERCIALES
## Rubrique : « Production / Dossiers en cours » (Espace Administration)

---

### 1. OBJECTIF & VISION GLOBALE
Mettre en place dans l'administration de Mariage Madagascar un cockpit opérationnel permettant le pilotage conjoint de chaque dossier client entre deux acteurs clés :
1. **Le Commercial** : de la qualification du prospect jusqu'à la signature du devis et validation finale.
2. **Le Chargé de Production** : de la réservation concrète des prestations jusqu'à l'exécution sans faille du Jour J.

Chaque dossier est directement rattaché à un client (`client_profiles`), à son projet de mariage (`client_projects`) ou à sa commande (`orders`).

---

### 2. CYCLE DE VIE & STATUTS DU DOSSIER

Chaque fiche de dossier suit un flux clair et balisé :
- `IN PROCESS` : Dossier en cours de traitement / constitution.
- `En attente d'informations` : En attente d'éléments complémentaires de la part du client ou d'un prestataire.
- `En attente de validation client` : Devis ou proposition envoyée, attente de l'accord ou de l'acompte client.
- `En cours de réservation` : Accord obtenu, le chargé de production bloque les hébergements, prestataires et logistique.
- `Production confirmée` : Tous les prestataires sont réservés, contrats signés, feuille de route prête.
- `Terminé` : Événement déroulé avec succès, facturation et retours de clôture effectués.

---

### 3. STRUCTURE DÉTAILLÉE DE LA FICHE DOSSIER

La fiche dossier se compose de deux volets interactifs éditables progressivement :

#### A. VOLET COMMERCIAL
*Champs et sections complétés par le commercial :*
1. **Identité & Contact Client :**
   - Nom complet, e-mail, téléphone, pays de résidence.
   - Date souhaitée de l'événement et flexibilité.
   - Destination choisie (Nosy Be, Sainte-Marie, Diego-Suarez, Tuléar, Morondava, Antananarivo).
   - Nombre estimé d'invités (adultes, enfants).
2. **Besoins & Vision du Couple :**
   - Style de célébration (symbolique, laïque, elopement, renouvellement, mariage traditionnel).
   - Ambiance recherchée, souhaits spécifiques (arche sur plage, dîner ponton, drone, musique live).
   - Budget prévisionnel client (€).
3. **Offre & Chiffrage Commercial :**
   - Forfait principal sélectionné (issu du catalogue `mm_products`).
   - Prestations optionnelles retenues (transferts, hébergement, excursions, repas traiteur).
   - Montant total proposé TTC (€) et conditions de paiement (acompte %, solde).
   - Lien vers le devis officiel Stripe ou PDF édité.
4. **Suivi & Jalons Commerciaux :**
   - Date de premier contact.
   - Date d'envoi du devis.
   - Date de validation / signature.
   - Notes et compte-rendu d'échanges avec le client.

---

#### B. VOLET CHARGÉ DE PRODUCTION
*Champs et sections complétés par le chargé de production :*
1. **Hébergements & Réceptions :**
   - Établissement réservé (nom de la villa, de l'écolodge ou du resort).
   - Dates d'arrivée et de départ des mariés et des invités.
   - Nombre de chambres / bungalows confirmés, statut de réservation.
2. **Coordination des Fournisseurs & Disponibilités :**
   - Traiteur / Chef à domicile (menu validé, régimes spécifiques).
   - Décoration florale & Scénographie (fleurs locales, arche, chaises, art de la table).
   - Photographe / Vidéaste / Drone (créneaux horaires, brief).
   - Sonorisation / Éclairage / DJ / Musiciens.
   - Officiant de cérémonie laïque.
   - Transport & Logistique (navettes aéroport, bateaux privatifs, transferts 4x4).
3. **Organisation du Jour J & Logistique :**
   - Lieu exact de la cérémonie (plage, îlot déserte, falaise, jardin).
   - Heure de début de mise en place.
   - Heure de la cérémonie et des festivités.
   - Plan B météo défini.
4. **Vérification & Validation Finale des Prestations :**
   - Checklist de pointage de chaque prestataire avant le Jour J.
   - Contrôle des contrats et acomptes prestataires versés.

---

### 4. LES TROIS FICHES COMPLÉMENTAIRES OPÉRATIONNELLES

Pour chaque dossier, trois fiches satellites spécialisées sont associées :

#### 1. Fiche Fournisseur
- **Rôle :** Centraliser pour chaque intervenant du dossier les éléments contractuels et opérationnels.
- **Informations répertoriées :**
  * Raison sociale / Nom de l'artisan ou prestataire.
  * Métier (fleuriste, skipper bateau, traiteur, photographe, hôtelier, musicien).
  * Coordonnées complètes (téléphone local, WhatsApp, e-mail, adresse).
  * Tarif convenu (€ ou MGA) et conditions de règlement (acompte, solde).
  * Statut de disponibilité et engagement écrit (confirmé, option posée, indisponible).
  * Notes sur la qualité de service et recommandations.

#### 2. Feuille de Route du Jour J
- **Rôle :** Le document de référence minute par minute distribué à l'équipe de production le Jour J.
- **Informations répertoriées :**
  * Chronologie précise heure par heure (ex: 08:00 Arrivée fleuriste, 14:00 Brief mariés, 16:30 Début cérémonie, 18:00 Coucher de soleil / Photos, 19:30 Dîner).
  * Pour chaque créneau : action à mener, lieu exact, personne responsable, contacts d'urgence.
  * Coordonnées directes des mariés et des témoins.
  * Contacts d'urgence locaux (médical, conciergerie, bateau de secours).

#### 3. Fiche de Rentabilité
- **Rôle :** Piloter la rentabilité financière et la marge dégagée par chaque dossier.
- **Informations répertoriées :**
  * **Prix de vente client :** Montant total facturé (€) issu de la commande/devis.
  * **Coûts réels de production décomposés :**
    - Hébergements : montant payé aux partenaires.
    - Prestataires (photo, fleurs, traiteur, officiant) : montants réels engagés.
    - Logistique & Transports (bateaux, carburant, navettes).
    - Frais de conciergerie / coordination sur place.
    - Frais de transaction Stripe / bancaires.
  * **Indicateurs calculés automatiquement :**
    - Coût total de revient (€).
    - Marge brute (€) = Prix de vente - Coûts réels.
    - Taux de marge brute (%).

---

### 5. INTÉGRATION ERGONOMIQUE DANS L'ADMIN EXISTANTE
- Emplacement dans la barre latérale partagée (`admin-shared.js`) :
  Nouveau lien de menu : `📁 Production` pointant vers `production.html` ou sous-section dans `mariages.html` ("Dossiers en cours").
- Vue sous forme de tableau interactif filtrable par statut (`IN PROCESS`, `En attente d'infos`, etc.) avec ouverture d'un panneau latéral (drawer) ou modal de détails pour compléter et sauvegarder les informations progressivement.
- Zéro redondance : liaison directe par `order_id` / `project_id` pour réutiliser automatiquement les données déjà présentes dans Supabase sans duplication.
