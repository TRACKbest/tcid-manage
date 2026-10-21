# Diagrammes UML — TCiD Center

Ces diagrammes décrivent le modèle de données et les flux ajoutés pour les
formations payantes, les documents par vidéo et la classe virtuelle.
Ils sont écrits en Mermaid (affichés directement par GitHub).

## Cas d'utilisation

```mermaid
flowchart LR
    A((Apprenant))
    F((Formateur))
    AD((Administrateur))

    A --> UC1[Regarder la 1re vidéo gratuite]
    A --> UC2[Payer par Orange Money / Airtel Money / MVola]
    A --> UC3[Envoyer la référence et le montant]
    A --> UC4[Suivre les vidéos et documents débloqués]
    A --> UC5[Rejoindre la classe virtuelle]
    A --> UC6[Poser une question à l'assistant IA]

    F --> UC7[Fixer le prix de sa formation]
    F --> UC8[Publier une vidéo + 0..n documents]
    F --> UC9[Rédiger la description avec mise en forme / IA]
    F --> UC10[Animer une classe virtuelle]
    F --> UC11[Consulter les paiements reçus]

    AD --> UC12[Vérifier la référence et valider le paiement]
    AD --> UC13[Refuser un paiement avec motif]
    AD --> UC14[Suivre les revenus et statistiques]
```

## Diagramme de classes (extrait)

```mermaid
classDiagram
    class Teacher {
      +full_name
      +email
      +password (haché)
    }
    class Student {
      +fullname
      +email
      +password (haché)
    }
    class Course {
      +title
      +description (HTML nettoyé)
      +price : int (Ar, 0 = gratuit)
      +is_paid() bool
      +first_chapter_id()
    }
    class Chapter {
      +title
      +description (HTML nettoyé)
      +video
      +position : int
      +is_free_preview : bool
    }
    class ChapterDocument {
      +title
      +description (HTML nettoyé)
      +upload
      +position : int
      +extracted_text
    }
    class CoursePayment {
      +method : orange_money | airtel_money | mvola
      +amount : int
      +expected_amount : int
      +reference : str (unique par opérateur, hors refusés)
      +status : pending | validated | rejected
      +amount_received
      +admin_note
      +reviewed_at
    }
    class StudentCourseEnrollment {
      +status : pending | approved | rejected
    }
    class LiveClassroom {
      +title
      +status : scheduled | live | ended
    }
    class Notification
    class User {
      <<Django admin>>
    }

    Teacher "1" --> "0..*" Course : enseigne
    Course "1" --> "0..*" Chapter : contient
    Chapter "1" --> "0..*" ChapterDocument : accompagne
    Student "1" --> "0..*" CoursePayment : envoie
    Course "1" --> "0..*" CoursePayment : concerne
    User "1" --> "0..*" CoursePayment : valide / refuse
    Student "1" --> "0..*" StudentCourseEnrollment
    Course "1" --> "0..*" StudentCourseEnrollment
    CoursePayment ..> StudentCourseEnrollment : validation = accès approuvé
    Course "1" --> "0..*" LiveClassroom
    CoursePayment ..> Notification : apprenant + formateur
```

Règles d'accès :

- la première vidéo (ordre `position`) et les vidéos `is_free_preview` sont visibles par tous ;
- les autres vidéos et leurs documents exigent une inscription **approuvée** ;
- formation payante : l'inscription est approuvée **uniquement** par la validation du paiement par l'administrateur ;
- formation gratuite : le formateur approuve les demandes d'accès comme avant.

## Séquence — paiement d'une formation

```mermaid
sequenceDiagram
    actor A as Apprenant
    participant W as Site (React)
    participant API as API Django
    actor AD as Administrateur

    A->>W: Clique « Débloquer la formation »
    W->>API: GET /payment-methods/
    API-->>W: Orange 0379069983 · Airtel 0332354093 · MVola 0342534546 (Alex Fare)
    A->>A: Paie par mobile money, reçoit le SMS (réf. 64494665)
    A->>W: Saisit référence + montant
    W->>API: POST /courses/{id}/payments/
    API-->>W: 201 pending (+ notification apprenant)
    AD->>API: GET /admin-ui/payments/?status=pending
    AD->>API: POST /admin-ui/payments/{id}/validate/ {reference, amount_received}
    alt référence identique et montant ≥ prix
        API->>API: statut validated + inscription approved
        API-->>A: Notification « Paiement validé »
        API-->>W: Toutes les vidéos et documents débloqués
    else référence différente
        API-->>AD: 400 « La référence ne correspond pas »
    end
```

## Séquence — classe virtuelle (WebRTC)

```mermaid
sequenceDiagram
    participant N as Nouveau participant
    participant S as Serveur (WebSocket)
    participant E as Participant déjà présent
    participant T as Relais TURN (coturn)

    N->>N: Test caméra/micro (une seule demande getUserMedia)
    N->>S: POST /join → jeton + serveurs ICE (STUN + TURN temporaire)
    N->>S: WebSocket connect
    S-->>E: participant_joined
    E->>E: addTransceiver(audio) + addTransceiver(video)
    E->>S: offer
    S-->>N: offer
    N->>N: setRemoteDescription puis replaceTrack(piste locale)
    N->>S: answer + candidats ICE
    S-->>E: answer + candidats ICE
    E-->>N: média direct (P2P) ou via T si NAT / réseau mobile
    Note over E,N: échec ICE → restartIce automatique ; coupure WebSocket → reconnexion automatique
```
