# Lokoto — Spécifications Métier : Cas d'Usage et Contraintes des Loueurs de Véhicules au Sénégal

Date de rédaction : Mai 2026

Objet : Document de cadrage approfondi détaillant l'ensemble des cas d'usage
opérationnels et des contraintes systémiques rencontrés par les gestionnaires
et propriétaires d'agences de location (voitures, motos, scooters, minibus)
au Sénégal. Ce document sert de référentiel technique et fonctionnel pour le
déploiement de la solution SaaS Lokoto.

## 1. Introduction et Objectif du Document

Le marché de la location de véhicules au Sénégal (particulièrement à Dakar,
Thiès, Saly et Ziguinchor) connaît une forte croissance portée par
l'urbanisation, le tourisme et l'émergence d'activités logistiques.
Cependant, la majorité des agences opèrent encore selon des modèles
artisanaux ou informels. Ce document vise à formaliser de manière exhaustive
les processus métier, les besoins opérationnels critiques (Cas d'Usage) et
les obstacles environnementaux (Contraintes) auxquels font face les loueurs,
afin d'y aligner précisément les fonctionnalités de la plateforme Lokoto.

## 2. Analyse Détaillée des Contraintes du Marché Sénégalais

### 2.1. Contraintes d'Infrastructures et Environnementales

- **Ruptures d'Énergie (Délestages)** : Les coupures d'électricité récurrentes
  coupent l'accès aux ordinateurs de bureau et aux réseaux Wi-Fi locaux,
  immobilisant les systèmes d'information cloud standards non préparés.
- **Instabilité de la Connexion Internet** : La couverture 4G/5G peut être
  fluctuante, notamment lors des déplacements interurbains ou dans certaines
  zones denses de la capitale. Un outil de gestion doit impérativement
  tolérer un fonctionnement en mode dégradé ou hors-ligne.
- **Dégradation Routière et Climat** : La présence de pistes, la poussière et
  les inondations hivernales accélèrent l'usure mécanique des véhicules et
  exigent un suivi drastique de l'intégrité physique du matériel.

### 2.2. Contraintes de Sécurité, Risques et Cadre Juridique

- **Fraude Documentaire** : Risque élevé d'usurpation d'identité ou de
  présentation de faux permis de conduire, particulièrement lors de
  réservations de dernière minute ou de transactions de gré à gré.
- **Détournement d'Actifs et Abus de Confiance** : Cas fréquents de clients
  sous-louant le véhicule sans autorisation, l'utilisant hors des zones
  convenues (ex: passage de frontières), ou refusant de restituer le
  matériel à l'échéance.
- **Litiges Non Écrits** : La prédominance des accords verbaux ou via
  messages informels (WhatsApp) complique le recouvrement en cas d'accident
  ou de dégradation majeure imputable au client.

### 2.3. Contraintes Financières et Flux de Trésorerie

- **Éclatement des Canaux de Paiement** : Coexistence complexe entre les
  paiements en espèces (cash-dominant), le Mobile Money (Wave, Orange Money)
  et de manière marginale les cartes bancaires ou virements.
- **Gestion Floue des Cautions** : Difficulté à bloquer ou restituer
  proprement des cautions financières en l'absence de terminaux bancaires
  adaptés, générant des frictions de trésorerie et des conflits avec les
  clients.
- **Dilution des Coûts** : L'absence d'imputation précise des frais annexes
  (carburant, petites réparations, péages) par véhicule fausse le calcul de
  la marge nette par actif.

## 3. Cartographie des Cas d'Usage Opérationnels (Use Cases)

### Cas d'Usage n°1 : Onboarding Client, Vérification et Contractualisation

Acteur Principal : Agent d'accueil / Gestionnaire de l'agence.

Description du processus : À l'arrivée du client, l'agent doit capturer de
manière fiable son identité et son historique pour mitiger le risque de
fraude.

1. Numérisation instantanée via l'appareil photo du smartphone des pièces
   obligatoires (CNI/Passeport, Permis de conduire).
2. Interrogation instantanée de la base de données interne pour extraire le
   Scoring de fiabilité (antécédents de sinistres, retards de paiement,
   comportement routier antérieur).
3. Édition automatisée du contrat de location numérique pré-rempli avec les
   mentions légales sénégalaises, envoyé directement par SMS/WhatsApp au
   client pour signature ou validation.

### Cas d'Usage n°2 : Suivi en Circulation, Géolocalisation et Sécurisation

Acteur Principal : Responsable de Flotte / Propriétaire.

Description du processus : Assurer la surveillance active des véhicules
loués sans intrusion abusive, mais en garantissant la préservation de
l'actif.

1. Le système lit en continu les coordonnées du boîtier GPS intégré (fourni
   et posé à J+1).
2. Application automatique de barrières géographiques (Géofencing). Si une
   voiture ou une moto sort de la zone autorisée (ex: axe Dakar-Thiès-Mbour
   ou sortie du territoire national), une alerte critique push et WhatsApp
   est émise instantanément vers le propriétaire.
3. Calcul en temps réel du kilométrage parcouru pour anticiper les
   dépassements de forfaits contractuels et ajuster la facturation lors de
   la restitution.

### Cas d'Usage n°3 : Cycle de Maintenance, Gestion Préventive et Carnet d'Entretien

Acteur Principal : Gestionnaire Technique / Mécanicien affilié.

Description du processus : Rompre avec le modèle de la maintenance curative
(réparation après panne) pour maximiser le taux de disponibilité de la
flotte.

1. Paramétrage de seuils kilométriques ou temporels automatisés (ex :
   vidange tous les 5 000 km, renouvellement d'assurance ou contrôle
   technique annuel).
2. Notification proactive à l'équipe technique dès que le véhicule approche
   du seuil, bloquant automatiquement sa disponibilité sur le calendrier de
   réservation pour la journée concernée.
3. Saisie des factures de pièces de rechange et main d'œuvre pour consolider
   le coût total de possession (TCO) de l'actif.

### Cas d'Usage n°4 : Réconciliation Financière et Calcul de Rentabilité par Véhicule

Acteur Principal : Comptable / Propriétaire d'Agence.

Description du processus : Centraliser les entrées et sorties d'argent pour
obtenir une visibilité financière nette, sans saisie Excel fastidieuse en
fin de mois.

1. Enregistrement immédiat de chaque flux : encaissement de loyer,
   perception de caution, versement d'acompte par Mobile Money.
2. Consolidation automatique par véhicule. Le tableau de bord affiche le
   ratio : (Revenus de location) - (Frais de maintenance + Assurance +
   Taxes) = Bénéfice Réel.
3. Génération d'un rapport de performance mensuel au format PDF/Comptable
   pour évaluer la pertinence de revendre un actif peu rentable ou
   d'agrandir la flotte sur les segments les plus demandés.

### Cas d'Usage n°5 : Vente en Ligne, Autonomie Client et Réservation Automatisée

Acteur Principal : Client Final / Prospect.

Description du processus : Désengorger le canal de discussion WhatsApp en
permettant aux clients de réserver directement en ligne en toute autonomie.

1. Le client accède au mini-site web généré automatiquement (ex:
   lokoto.sn/nom-de-lagence).
2. Consultation en temps réel du catalogue des véhicules disponibles, filtré
   par type (berline, 4x4, scooter, moto) et par prix journalier.
3. Sélection des dates, validation de la commande et paiement instantané de
   l'acompte de sécurisation via Wave ou Orange Money, déclenchant l'envoi
   d'un reçu automatisé et bloquant le véhicule dans le calendrier général
   de l'agence.

## 4. Matrice de Résolution : Problématiques vs. Réponses Lokoto

| Friction / Contrainte Terrain | Impact Business Négatif | Module de Réponse Lokoto |
| --- | --- | --- |
| Délestages d'électricité fréquents | Paralysie du secrétariat, impossibilité de faire signer un contrat. | Mode Hors-Ligne 100% Mobile : Enregistrement local des données et synchronisation automatique dès reconnexion. |
| Réservations éparpillées sur les téléphones des agents via WhatsApp | Sur-réservation (double booking), perte d'acompte, oublis de restitution. | Vitrine Web Auto-générée & Synchro Réelle : Calendrier centralisé mis à jour instantanément à chaque réservation en ligne ou physique. |
| Calcul manuel de la rentabilité de la flotte sur Excel | Erreurs de calcul, incapacité à identifier les véhicules déficitaires. | Comptabilité Automatisée par Actif : Ventilation des entrées/sorties par immatriculation avec rapports financiers exportables en 2 secondes. |
| Vols, abus de confiance et sorties de zones autorisées | Pertes financières massives, immobilisation prolongée au garage ou commissariat. | Bundling Matériel + Logiciel : Fourniture, installation à J+1 et intégration native d'un boîtier GPS avec alertes géofencing. |

## 5. Conclusion et Prochaines Étapes

L'alignement rigoureux entre les contraintes du marché sénégalais et
l'architecture fonctionnelle de Lokoto garantit une adoption rapide par les
utilisateurs. En éliminant la complexité de l'onboarding technique grâce au
pack tout-en-un (logiciel + GPS posé), Lokoto se positionne non comme un
outil conceptuel importé, mais comme un partenaire de croissance direct pour
les entrepreneurs de la mobilité au Sénégal. Les prochaines étapes
consisteront à valider les premiers tests utilisateurs basés sur cette
grille d'analyse au cours du cycle de lancement freemium prévu pour 2026.
