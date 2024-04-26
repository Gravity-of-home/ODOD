package com.homegravity.Odi.domain.party.respository.custom;

import com.homegravity.Odi.domain.member.entity.Member;
import com.homegravity.Odi.domain.party.dto.PartyMemberDTO;
import com.homegravity.Odi.domain.party.entity.Party;
import com.homegravity.Odi.domain.party.entity.RoleType;

import java.util.List;

public interface CustomPartyMember {

    Long countAllPartyGuests(Party party);

    RoleType findParticipantRole(Member member);

    List<PartyMemberDTO> findAllPartyGuests(Party party);

    List<PartyMemberDTO> findAllPartyParticipants(Party party);

}
